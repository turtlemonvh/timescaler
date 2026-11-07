import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { resolveAnimal } from '../../scene/animals/roster';
import type { Profile } from '../../storage/types';

export interface ProfileSwitcherProps {
  /** Every saved profile except the active one, in save order. */
  otherProfiles: Profile[];
  onSwitchProfile: (profileId: string) => void;
  /** Starts the usual name -> animal flow for a brand-new climber. */
  onNewProfile: () => void;
}

function menuItems(menu: HTMLElement | null): HTMLButtonElement[] {
  return Array.from(menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
}

/**
 * The caret next to the Map's profile pill: a menu-button listing the other
 * saved climbers plus "+ New climber". The pill itself keeps opening the
 * profile page, so this is a separate, small control rather than a change
 * to what the pill does.
 *
 * Follows the WAI-ARIA menu-button pattern: the trigger carries
 * `aria-haspopup`/`aria-expanded`, opening moves focus to the first item,
 * ArrowUp/ArrowDown/Home/End move between items, Escape closes and puts
 * focus back on the trigger, and Tab or a click outside just closes.
 */
export default function ProfileSwitcher({
  otherProfiles,
  onSwitchProfile,
  onNewProfile,
}: ProfileSwitcherProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Opening moves focus into the menu (no state change here, just the DOM).
  useEffect(() => {
    if (open) menuItems(menuRef.current)[0]?.focus();
  }, [open]);

  // A press anywhere outside the switcher closes it, like a native <select>.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function close({ restoreFocus }: { restoreFocus: boolean }) {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = menuItems(menuRef.current);
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close({ restoreFocus: true });
        return;
      case 'Tab':
        close({ restoreFocus: false });
        return;
      case 'ArrowDown':
        next = (index + 1) % list.length;
        break;
      case 'ArrowUp':
        next = (index - 1 + list.length) % list.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = list.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    list[next]?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div className="profile-switcher" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="chip-button profile-switcher__trigger"
        data-testid="profile-switch-toggle"
        aria-label="Switch climber"
        title="Switch climber"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={onTriggerKeyDown}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M5 9l7 7 7-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label="Switch climber"
          className="profile-switcher__menu"
          data-testid="profile-switch-menu"
          onKeyDown={onMenuKeyDown}
        >
          <p className="profile-switcher__heading" aria-hidden="true">
            Switch climber
          </p>
          {otherProfiles.map((profile) => {
            const animal = resolveAnimal(profile.characterId);
            return (
              <button
                key={profile.id}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="profile-switcher__item"
                data-testid={`profile-switch-${profile.id}`}
                onClick={() => {
                  close({ restoreFocus: false });
                  onSwitchProfile(profile.id);
                }}
              >
                <span
                  className="profile-chip__animal"
                  style={{ background: animal.accent }}
                  aria-hidden="true"
                >
                  {animal.name[0]}
                </span>
                {profile.name}
              </button>
            );
          })}
          {otherProfiles.length > 0 && (
            <div role="separator" className="profile-switcher__separator" />
          )}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="profile-switcher__item"
            data-testid="profile-switch-new"
            onClick={() => {
              close({ restoreFocus: false });
              onNewProfile();
            }}
          >
            + New climber
          </button>
        </div>
      )}
    </div>
  );
}
