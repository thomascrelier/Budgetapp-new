'use client';

import { useState } from 'react';
import { DocumentIcon, Pill, PlacementPill, size, thumbnailUrl } from './taxShared';

// One file from the receipts folder. Linked: the transaction and its T776 pill. Unlinked: a dashed "Match it" tile.
// The thumbnail loads in the owner's browser (they own the files); a document icon stands in when it can't.
// The image's alt text names the file for assistive tech, so the visible name is hidden from it until the
// image fails (then the name is the only place the file is named).
export default function ReceiptTile({ file, placement, suggestion, onOpen }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const linked = file.transaction;

  return (
    <li className="min-w-0">
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={(e) => onOpen(file, e.currentTarget)}
        className={`card-interactive w-full h-full text-left rounded-xl border bg-surface p-2 flex flex-col gap-1.5 ${
          linked ? 'border-border' : 'border-dashed border-warning/70'
        }`}
      >
        <span className="block aspect-[4/3] w-full rounded-lg overflow-hidden bg-surface-hover text-text-muted">
          {thumbFailed ? (
            <span className="flex h-full w-full items-center justify-center"><DocumentIcon /></span>
          ) : (
            <img
              src={thumbnailUrl(file.id)}
              alt={file.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)}
              className="h-full w-full object-cover"
            />
          )}
        </span>
        <span className="px-1 text-sm font-medium text-text-primary break-words line-clamp-2" aria-hidden={thumbFailed ? undefined : true}>
          {file.name}
        </span>
        {linked ? (
          <>
            <span className="px-1 text-xs text-text-secondary break-words">
              {linked.description} · <span className="tabular">{size(linked)}</span>
            </span>
            <span className="px-1 mt-auto"><PlacementPill placement={placement} /></span>
          </>
        ) : (
          <>
            <span className="px-1 text-xs text-text-tertiary break-words">
              {suggestion ? (
                <>Suggested: {suggestion.description} · <span className="tabular">{size(suggestion)}</span></>
              ) : 'No matching transaction'}
            </span>
            <span className="px-1 mt-auto"><Pill tone="warn">Match it</Pill></span>
          </>
        )}
      </button>
    </li>
  );
}
