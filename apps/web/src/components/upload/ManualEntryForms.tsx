'use client';

import { Button } from '@/components/ui/Button';
import { EditableItem } from './EditableFieldList';
import type { UploadCategoryId } from './CategoryUploadCard';

interface ManualEntryFormProps {
  categoryId: UploadCategoryId;
  categoryLabel: string;
  items: Record<string, string>[];
  onItemChange: (index: number, key: string, value: string) => void;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}

export function ManualEntryForm({
  categoryId,
  categoryLabel,
  items,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onSave,
  onCancel,
  saving,
}: ManualEntryFormProps) {
  const singularLabel = categoryLabel.toLowerCase().replace(/s$/, '');

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item, i) => (
          <EditableItem
            key={i}
            categoryId={categoryId}
            item={item}
            index={i}
            onChange={onItemChange}
            onRemove={onRemoveItem}
            showRemove={items.length > 1}
          />
        ))}
      </div>

      {categoryId !== 'insurance' && (
        <button
          onClick={onAddItem}
          className="w-full text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors py-1 flex items-center justify-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add another {singularLabel}
        </button>
      )}

      <div className="flex gap-2 pt-1">
        <Button onClick={onSave} loading={saving} className="flex-1">
          Save
        </Button>
        <Button variant="secondary" onClick={onCancel} className="!px-4">
          Cancel
        </Button>
      </div>
    </div>
  );
}
