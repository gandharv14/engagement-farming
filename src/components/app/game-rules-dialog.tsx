"use client";

import * as React from "react";
import { BookOpenCheck, CheckCircle2, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";

import { Button } from "@/components/ui/button";
import { TOKENS_PER_PROBLEM } from "@/lib/sprint-config";

const rules = [
  "Log each submitted row with its task type and token count so your daily cadence stays visible.",
  `A problem will only be accepted if it has more than ${TOKENS_PER_PROBLEM.toLocaleString()} tokens.`,
  "Accepted rows advance your streak based on the day you submitted them, not the day they were reviewed.",
  "Pending rows show provisional streak upside until quality checks land. Bonuses apply only after review.",
  "Finale bounties and quality multipliers follow the active sprint configuration.",
];

let hasShownRulesThisAppOpen = false;

export function GameRulesDialog({ autoOpen = true }: { autoOpen?: boolean }) {
  const [open, setOpen] = React.useState(() => autoOpen && !hasShownRulesThisAppOpen);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      hasShownRulesThisAppOpen = true;
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="border-arena-gold/40 bg-arena-gold/10 text-arena-gold hover:bg-arena-gold/20 hover:text-arena-gold"
        >
          <BookOpenCheck className="mr-1 h-4 w-4" />
          Rules
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(calc(100vw-2rem),42rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl border border-arena-cyan/25 bg-popover text-popover-foreground shadow-2xl shadow-arena-cyan/20 focus:outline-none">
          <div className="pointer-events-none h-1 bg-gradient-to-r from-arena-cyan via-arena-blue to-arena-pink" />
          <div className="space-y-5 p-6">
            <div className="pr-10">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-arena-gold">Game Rules</p>
              <Dialog.Title className="mt-2 text-2xl font-semibold tracking-tight">
                Welcome to Tokenmaxxing
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                Maximize tokens and problem, protect your streak, and keep the sprint moving.
              </Dialog.Description>
            </div>

            <ol className="space-y-3">
              {rules.map((rule, index) => (
                <li key={rule} className="flex gap-3 rounded-2xl border border-arena-cyan/15 bg-arena-cyan/5 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-arena-cyan/15 font-mono text-xs text-arena-cyan">
                    {index + 1}
                  </span>
                  <span className="text-sm leading-6 text-muted-foreground">{rule}</span>
                </li>
              ))}
            </ol>

            <div className="rounded-2xl border border-arena-gold/25 bg-arena-gold/10 p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-arena-gold">
                <CheckCircle2 className="h-4 w-4" />
                Play fair, play daily
              </div>
              Your goal is to keep high-quality token production consistent.
            </div>

            <div className="flex justify-end">
              <Dialog.Close asChild>
                <Button>Start maxxing</Button>
              </Dialog.Close>
            </div>
          </div>
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon-sm" className="absolute right-4 top-4">
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Close rules</span>
            </Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
