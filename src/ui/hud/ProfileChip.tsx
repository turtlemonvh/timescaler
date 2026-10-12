import type { ReactNode } from 'react';

export interface ProfileChipProps {
  name: string;
  /** Rendered animal preview, e.g. the Map screen's coloured initial badge — caller-supplied so
   * this component doesn't need to know about the animal roster. */
  preview?: ReactNode;
}

/** A small "who's playing" chip, shown persistently on the Map and Climb screens. */
export default function ProfileChip({ name, preview }: ProfileChipProps) {
  return (
    <div data-testid="profile-chip" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {preview && <span data-testid="profile-chip-preview">{preview}</span>}
      <span data-testid="profile-chip-name">{name}</span>
    </div>
  );
}
