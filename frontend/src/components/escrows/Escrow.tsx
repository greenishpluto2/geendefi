// Copyright (c) Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { useCurrentAccount, useSuiClientQuery } from "@mysten/dapp-kit";
import { SuiObjectDisplay } from "@/components/SuiObjectDisplay";
import { Button, TextField, Text, Badge, Card, Flex } from "@radix-ui/themes";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircledIcon,
  Cross1Icon,
  LockClosedIcon,
} from "@radix-ui/react-icons";
import { CONSTANTS, QueryKey } from "@/constants";
import { ExplorerLink } from "../ExplorerLink";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ApiEscrowObject } from "@/types/types";
import {
  useAcceptEscrowMutation,
  useCancelEscrowMutation,
} from "@/mutations/escrow";
import { useRevealSecretMutation } from "@/mutations/hashlock";
import { useGetLockedObject } from "@/hooks/useGetLockedObject";
import { LockedObject } from "../locked/LockedObject";

/**
 * A component that displays an escrow and allows the user to accept or cancel it.
 * Accepts an `escrow` object as returned from the API.
 */
export function Escrow({ escrow }: { escrow: ApiEscrowObject }) {
  const account = useCurrentAccount();
  const [isToggled, setIsToggled] = useState(true);
  const [secret, setSecret] = useState<string>("");
  const [showSecretInput, setShowSecretInput] = useState(false);
  
  const { mutate: acceptEscrowMutation, isPending } = useAcceptEscrowMutation();
  const { mutate: cancelEscrowMutation, isPending: pendingCancellation } =
    useCancelEscrowMutation();
  const { mutate: revealSecretMutation, isPending: pendingSecretReveal } = 
    useRevealSecretMutation();

  const suiObject = useSuiClientQuery("getObject", {
    id: escrow?.itemId,
    options: {
      showDisplay: true,
      showType: true,
    },
  });

  const lockedData = useQuery({
    queryKey: [QueryKey.Locked, escrow.keyId],
    queryFn: async () => {
      const res = await fetch(
        `${CONSTANTS.apiEndpoint}locked?keyId=${escrow.keyId}`,
      );
      return res.json();
    },
    select: (data) => data.data[0],
    enabled: !escrow.cancelled,
  });

  const { data: suiLockedObject } = useGetLockedObject({
    lockedId: lockedData.data?.objectId,
  });

  const getLabel = () => {
    if (escrow.cancelled) return "Cancelled";
    if (escrow.swapped) return "Swapped";
    if (escrow.secretRevealed) return "Secret Revealed";
    if (escrow.sender === account?.address) {
      return escrow.isHashlock ? "You offer this (Hashlock)" : "You offer this";
    }
    if (escrow.recipient === account?.address) {
      return escrow.isHashlock ? "You'll receive this (Hashlock)" : "You'll receive this";
    }
    return undefined;
  };
  const getLabelClasses = () => {
    if (escrow.cancelled) return "text-red-500";
    if (escrow.swapped) return "text-green-500";
    if (escrow.secretRevealed) return "text-orange-500";
    if (escrow.sender === account?.address)
      return "bg-blue-50 rounded px-3 py-1 text-sm text-blue-500";
    if (escrow.recipient === account?.address)
      return "bg-green-50 rounded px-3 py-1 text-sm text-green-700";
    return undefined;
  };

  const isHashlockTimedOut = () => {
    if (!escrow.isHashlock || !escrow.timeoutMs) return false;
    const timeoutTime = parseInt(escrow.timeoutMs);
    const currentTime = Date.now();
    return currentTime >= timeoutTime;
  };

  const getTimeRemaining = () => {
    if (!escrow.isHashlock || !escrow.timeoutMs) return null;
    const timeoutTime = parseInt(escrow.timeoutMs);
    const currentTime = Date.now();
    const remaining = timeoutTime - currentTime;
    
    if (remaining <= 0) return "Expired";
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h remaining`;
    if (hours > 0) return `${hours}h remaining`;
    return "< 1h remaining";
  };

  return (
    <SuiObjectDisplay
      object={suiObject.data?.data!}
      label={getLabel()}
      labelClasses={getLabelClasses()}
    >
      <div className="p-4 flex gap-3 flex-wrap">
        {
          <p className="text-sm flex-shrink-0 flex items-center gap-2">
            <ExplorerLink id={escrow.objectId} isAddress={false} />
          </p>
        }
        <Button
          className="ml-auto cursor-pointer bg-transparent text-black"
          onClick={() => setIsToggled(!isToggled)}
        >
          Details
          {isToggled ? <ArrowUpIcon /> : <ArrowDownIcon />}
        </Button>
        {!escrow.cancelled &&
          !escrow.swapped &&
          escrow.sender === account?.address && (
            <Button
              color="amber"
              className="cursor-pointer"
              disabled={pendingCancellation}
              onClick={() =>
                cancelEscrowMutation({
                  escrow,
                  suiObject: suiObject.data?.data!,
                })
              }
            >
              <Cross1Icon />
              Cancel request
            </Button>
          )}
        {isToggled && lockedData.data && (
          <div className="min-w-[340px] w-full justify-self-start text-left">
            {suiLockedObject?.data && (
              <LockedObject
                object={suiLockedObject.data}
                itemId={lockedData.data.itemId}
                hideControls
              />
            )}

            {!lockedData.data.deleted &&
              escrow.recipient === account?.address && (
                <div className="mt-5">
                  {escrow.isHashlock ? (
                    <div className="space-y-3">
                      <Card className="p-3 bg-purple-50">
                        <Flex align="center" gap="2" className="mb-2">
                          <LockClosedIcon />
                          <Text size="2" weight="medium">Hashlock Escrow</Text>
                          {escrow.hashCommitment && (
                            <Badge color="purple">Secret Required</Badge>
                          )}
                        </Flex>
                        {getTimeRemaining() && (
                          <Text size="1" color="gray">
                            ⏱️ {getTimeRemaining()}
                          </Text>
                        )}
                        {escrow.secretRevealed && (
                          <Text size="1" color="green">
                            ✅ Secret already revealed
                          </Text>
                        )}
                      </Card>
                      
                      {!escrow.swapped && !escrow.secretRevealed && !isHashlockTimedOut() && (
                        <div className="space-y-3">
                          {!showSecretInput ? (
                            <div className="text-right">
                              <Button
                                className="cursor-pointer"
                                onClick={() => setShowSecretInput(true)}
                              >
                                <LockClosedIcon /> Reveal Secret
                              </Button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div>
                                <Text as="label" size="2" weight="medium">
                                  Enter Secret:
                                </Text>
                                <TextField.Root
                                  type="password"
                                  placeholder="Enter the secret to claim this escrow"
                                  value={secret}
                                  onChange={(e) => setSecret(e.target.value)}
                                />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="soft"
                                  onClick={() => {
                                    setShowSecretInput(false);
                                    setSecret("");
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  className="cursor-pointer"
                                  disabled={pendingSecretReveal || !secret}
                                  onClick={() => {
                                    console.log("Reveal & Claim button clicked");
                                    console.log("Data being passed:", { escrow, locked: lockedData.data, secret });
                                    
                                    revealSecretMutation({
                                      escrow,
                                      locked: lockedData.data,
                                      secret,
                                    }, {
                                      onSuccess: () => {
                                        console.log("Reveal secret succeeded");
                                        setSecret("");
                                        setShowSecretInput(false);
                                      },
                                      onError: (error) => {
                                        console.error("Reveal secret failed:", error);
                                        // You might want to show a toast notification here
                                      },
                                    });
                                  }}
                                >
                                  <CheckCircledIcon /> 
                                  {pendingSecretReveal ? "Revealing..." : "Reveal & Claim"}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {isHashlockTimedOut() && !escrow.swapped && (
                        <div className="text-center">
                          <Text size="2" color="red">
                            ⏰ This hashlock has expired. The sender can now reclaim their item.
                          </Text>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-right">
                      <p className="text-xs pb-3">
                        When accepting the exchange, the escrowed item will be
                        transferred to you and your locked item will be transferred
                        to the sender.
                      </p>
                      <Button
                        className="cursor-pointer"
                        disabled={isPending}
                        onClick={() =>
                          acceptEscrowMutation({
                            escrow,
                            locked: lockedData.data,
                          })
                        }
                      >
                        <CheckCircledIcon /> Accept exchange
                      </Button>
                    </div>
                  )}
                </div>
              )}
            {lockedData.data.deleted &&
              !escrow.swapped &&
              escrow.recipient === account?.address && (
                <div>
                  <p className="text-red-500 text-sm py-2 flex items-center gap-3">
                    <Cross1Icon />
                    The locked object has been deleted so you can't accept this
                    anymore.
                  </p>
                </div>
              )}
          </div>
        )}
      </div>
    </SuiObjectDisplay>
  );
}
