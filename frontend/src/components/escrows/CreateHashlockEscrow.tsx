// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { ApiLockedObject } from "@/types/types";
import { useCurrentAccount, useSuiClientInfiniteQuery } from "@mysten/dapp-kit";
import { formatAddress } from "@mysten/sui/utils";
import { Avatar, Button, Select, TextField, Flex, Text, Card, Badge } from "@radix-ui/themes";
import { InfiniteScrollArea } from "@/components/InfiniteScrollArea";
import { useState } from "react";
import { ExplorerLink } from "../ExplorerLink";
import { useCreateHashlockEscrowMutation } from "@/mutations/hashlock";

/**
 * A component that allows the user to create a hashlock escrow for a locked object.
 * This includes setting a secret and timeout for cross-chain atomic swaps.
 */
export function CreateHashlockEscrow({ locked }: { locked: ApiLockedObject }) {
  const [objectId, setObjectId] = useState<string | undefined>(undefined);
  const [secret, setSecret] = useState<string>("");
  const [timeoutHours, setTimeoutHours] = useState<number>(24); // Default 24 hours
  const account = useCurrentAccount();

  const { mutate: createHashlockEscrowMutation, isPending } = useCreateHashlockEscrowMutation();

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
            // Filter out locked objects and keys to show only regular objects
            .filter((obj) => obj.data?.type && 
              !obj.data.type.includes("::lock::") && 
              !obj.data.type.includes("::hashlock::")),
      },
    );

  const getObject = () => {
    const object = data?.find((x) => x.data?.objectId === objectId);
    if (!object || !object.data) {
      return;
    }
    return object.data;
  };

  const isFormValid = () => {
    return objectId && secret.length >= 8 && timeoutHours > 0;
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge color="purple">Hashlock Escrow</Badge>
          <Text size="2" color="gray">
            Create a cross-chain atomic swap with hash commitment
          </Text>
        </div>

        <div className="space-y-3">
          <div>
            <Text as="label" size="2" weight="medium">
              Secret (min 8 characters)
            </Text>
            <TextField.Root
              placeholder="Enter your secret for the hashlock"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              type="password"
            />
            <Text size="1" color="gray">
              This secret will be required to claim the escrowed item. Keep it safe!
            </Text>
          </div>

          <div>
            <Text as="label" size="2" weight="medium">
              Timeout (hours)
            </Text>
            <TextField.Root
              type="number"
              placeholder="24"
              value={timeoutHours.toString()}
              onChange={(e) => setTimeoutHours(parseInt(e.target.value) || 24)}
              min="1"
              max="8760" // 1 year
            />
            <Text size="1" color="gray">
              Time limit for the recipient to reveal the secret and claim
            </Text>
          </div>

          <div>
            <Text as="label" size="2" weight="medium">
              Your object to escrow
            </Text>
            <Select.Root value={objectId} onValueChange={setObjectId}>
              <Select.Trigger placeholder="Select an object to put in hashlock escrow" />
              <Select.Content>
                <InfiniteScrollArea
                  loadMore={() => fetchNextPage()}
                  hasNextPage={hasNextPage}
                  loading={isFetchingNextPage}
                >
                  {data?.map((object) => (
                    <Select.Item
                      key={object.data?.objectId}
                      value={object.data?.objectId!}
                    >
                      <Flex align="center" gap="2">
                        <Avatar
                          size="1"
                          src={object.data?.display?.data?.image_url}
                          fallback="📦"
                        />
                        <div>
                          <Text size="2">
                            {object.data?.display?.data?.name ||
                              formatAddress(object.data?.objectId!)}
                          </Text>
                          <Text size="1" color="gray">
                            {object.data?.display?.data?.description}
                          </Text>
                        </div>
                      </Flex>
                    </Select.Item>
                  ))}
                </InfiniteScrollArea>
              </Select.Content>
            </Select.Root>
          </div>

          {objectId && (
            <Card className="p-3 bg-gray-50">
              <Text size="2" weight="medium">Selected Object:</Text>
              <div className="mt-2 flex items-center gap-2">
                <Avatar
                  size="2"
                  src={getObject()?.display?.data?.image_url}
                  fallback="📦"
                />
                <div>
                  <Text size="2">
                    {getObject()?.display?.data?.name || formatAddress(objectId)}
                  </Text>
                  <div className="flex gap-2 mt-1">
                    <ExplorerLink
                      id={objectId}
                      isAddress={false}
                      label="View Object"
                    />
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card className="p-3 bg-blue-50">
            <Text size="2" weight="medium" color="blue">Hashlock Info:</Text>
            <div className="mt-2 space-y-1">
              <Text size="1" color="gray">
                • Recipient: {formatAddress(locked.creator!)}
              </Text>
              <Text size="1" color="gray">
                • They need your secret to claim your object
              </Text>
              <Text size="1" color="gray">
                • You can reclaim after {timeoutHours} hours if unclaimed
              </Text>
              <Text size="1" color="gray">
                • This enables trustless cross-chain atomic swaps
              </Text>
            </div>
          </Card>
        </div>

        <div className="text-right">
          <Button
            className="cursor-pointer"
            disabled={isPending || !isFormValid()}
            onClick={() => {
              if (!isFormValid()) return;
              
              createHashlockEscrowMutation(
                { 
                  locked, 
                  object: getObject()!, 
                  secret,
                  timeoutHours
                },
                {
                  onSuccess: () => {
                    refetch();
                    setObjectId(undefined);
                    setSecret("");
                    setTimeoutHours(24);
                  },
                },
              );
            }}
          >
            {isPending ? "Creating..." : "Create Hashlock Escrow"}
          </Button>
        </div>
      </div>
    </Card>
  );
} 