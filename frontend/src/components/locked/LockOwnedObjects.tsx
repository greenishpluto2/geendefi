// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { useCurrentAccount, useSuiClientInfiniteQuery } from "@mysten/dapp-kit";
import { SuiObjectDisplay } from "@/components/SuiObjectDisplay";
import { Button, TextField } from "@radix-ui/themes";
import { LockClosedIcon } from "@radix-ui/react-icons";
import { InfiniteScrollArea } from "@/components/InfiniteScrollArea";
// import { useLockObjectMutation } from "@/mutations/locked";
import { useState } from "react";
import { useCreateHashlockMutation } from "@/mutations/hashlock";

/**
 * A component that fetches all the objects owned by the connected wallet address
 * and allows the user to lock them, so they can be used in escrow.
 */
export function LockOwnedObjects() {
  const account = useCurrentAccount();
  const { mutate: lockObjectMutation, isPending } = useCreateHashlockMutation();
  // Changed: Use Map to store secrets per object ID
  const [secrets, setSecrets] = useState(new Map());
  
  const { data, fetchNextPage, isFetchingNextPage, hasNextPage, refetch } =
    useSuiClientInfiniteQuery(
      "getOwnedObjects",
      {
        owner: account?.address!,
        options: {
          showDisplay: true,
          showType: true,
        },
      },
      {
        enabled: !!account,
        select: (data) =>
          data.pages
            .flatMap((page) => page.data)
            // .filter(
            //   // we're filtering out objects that don't have Display or image_url
            //   // for demo purposes. The Escrow contract works with all objects.
            //   (x) => !!x.data?.display && !!x.data?.display?.data?.image_url,
            // ),
      },
    );

  // Helper function to update secret for specific object
  const updateSecret = (objectId, value) => {
    setSecrets(prev => {
      const newSecrets = new Map(prev);
      newSecrets.set(objectId, value);
      return newSecrets;
    });
  };

  // Helper function to get secret for specific object
  const getSecret = (objectId) => {
    return secrets.get(objectId) || "";
  };

  // Helper function to clear secret for specific object
  const clearSecret = (objectId) => {
    setSecrets(prev => {
      const newSecrets = new Map(prev);
      newSecrets.delete(objectId);
      return newSecrets;
    });
  };
    
  return (
    <InfiniteScrollArea
      loadMore={() => fetchNextPage()}
      hasNextPage={hasNextPage}
      loading={isFetchingNextPage}
    >
      {data?.map((obj) => {
        const objectId = obj.data?.objectId;
        const currentSecret = getSecret(objectId);
        
        return (
          <SuiObjectDisplay key={objectId} object={obj.data!}>
            <div className="p-4 pt-1 text-right flex items-center justify-end">
              <div className="flex items-center gap-2">
                <TextField.Root
                  placeholder="Secret"
                  value={currentSecret}
                  onChange={(e) => updateSecret(objectId, e.target.value)}
                  disabled={isPending}
                />
                <Button
                  className="cursor-pointer"
                  disabled={isPending || !currentSecret.trim()}
                  onClick={() => {
                    lockObjectMutation(
                      { 
                        object: obj.data!, 
                        secret: currentSecret, 
                        timeoutHours: 0.0125, 
                        recipient: "0x93980ea3eab0a16154ab7fa77c3fab9bfbbcb12ea1a1f3bb36214c247209552f" 
                      }, // 45 sec
                      {
                        onSuccess: () => {
                          refetch();
                          clearSecret(objectId);
                        },
                        onError: (error) => {
                          alert(error);
                          console.warn(error);
                        }
                      },
                    );
                  }}
                >
                  <LockClosedIcon />
                  Lock Item
                </Button>
              </div>
            </div>
          </SuiObjectDisplay>
        );
      })}
    </InfiniteScrollArea>
  );
}