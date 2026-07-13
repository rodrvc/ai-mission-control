"use client";

import { useEffect, useRef } from "react";
import { EMAILS } from "@/data/emails";
import { useInboxStore } from "@/lib/store/inboxStore";

/**
 * Inbox modal (D11): list pane of delivered emails + reading pane. Opening an
 * email marks it read. Dismissible via close button, Escape, or click on the
 * backdrop. Focus moves into the panel on open and returns to the trigger on
 * close for accessibility.
 */
export function InboxModal() {
  const isOpen = useInboxStore((state) => state.isModalOpen);
  const deliveredIds = useInboxStore((state) => state.deliveredIds);
  const unreadIds = useInboxStore((state) => state.unreadIds);
  const selectedEmailId = useInboxStore((state) => state.selectedEmailId);
  const closeModal = useInboxStore((state) => state.closeModal);
  const selectEmail = useInboxStore((state) => state.selectEmail);

  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const deliveredEmails = EMAILS.filter((email) => deliveredIds.includes(email.id));
  const selectedEmail = deliveredEmails.find((email) => email.id === selectedEmailId) ?? null;

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeModal();
        return;
      }
      if (event.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) {
          event.preventDefault();
          panel.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey) {
          if (active === first || !panel.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (active === last || !panel.contains(active)) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [isOpen, closeModal]);

  // Auto-open the email only when it is the single one in the inbox (the
  // welcome case) — displaying it in the reading pane marks it read, mail-client
  // style, which is what triggers the mission batch on close. With multiple
  // emails delivered, nothing is auto-selected so they all stay unread until
  // the user explicitly opens one.
  useEffect(() => {
    if (isOpen && !selectedEmailId && deliveredEmails.length === 1) {
      selectEmail(deliveredEmails[0].id);
    }
    // Only run when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeModal();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ship inbox"
        tabIndex={-1}
        className="flex h-[32rem] w-full max-w-3xl overflow-hidden rounded-lg border border-panel-border bg-panel shadow-2xl outline-none"
      >
        {/* List pane */}
        <div className="flex w-64 shrink-0 flex-col border-r border-panel-border bg-panel-raised">
          <div className="flex items-center justify-between border-b border-panel-border px-4 py-3">
            <span className="font-mono text-xs font-semibold tracking-widest text-text-muted uppercase">
              Inbox
            </span>
          </div>
          <ul className="flex-1 overflow-y-auto">
            {deliveredEmails.map((email) => {
              const isUnread = unreadIds.includes(email.id);
              const isSelected = email.id === selectedEmailId;
              return (
                <li key={email.id}>
                  <button
                    type="button"
                    onClick={() => selectEmail(email.id)}
                    className={`flex w-full flex-col gap-1 border-b border-panel-border px-4 py-3 text-left hover:bg-panel ${
                      isSelected ? "bg-panel" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {isUnread && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-accent"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`truncate font-mono text-xs ${isUnread ? "font-semibold text-foreground" : "text-text-muted"}`}
                      >
                        {email.from}
                      </span>
                    </span>
                    <span
                      className={`truncate text-sm ${isUnread ? "text-foreground" : "text-text-muted"}`}
                    >
                      {email.subject}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Reading pane */}
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-panel-border px-5 py-3">
            <span className="truncate font-mono text-xs text-text-muted">
              {selectedEmail ? selectedEmail.subject : "No transmission selected"}
            </span>
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close inbox"
              className="shrink-0 rounded-md border border-panel-border px-2 py-1 font-mono text-xs text-text-muted hover:border-accent hover:text-accent"
            >
              Close
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {selectedEmail ? (
              <>
                <h2 className="mb-1 font-mono text-base font-semibold text-foreground">
                  {selectedEmail.subject}
                </h2>
                <p className="mb-4 font-mono text-xs text-text-muted">{selectedEmail.from}</p>
                {selectedEmail.body.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="mb-3 text-sm leading-relaxed text-foreground/90">
                    {paragraph}
                  </p>
                ))}
              </>
            ) : (
              <p className="text-sm text-text-muted">Select a transmission to read it.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
