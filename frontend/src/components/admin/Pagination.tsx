import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

/**
 * Standard table pagination: range summary, prev/next, page size selector.
 */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
}) => {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const safeTotalPages = Math.max(1, totalPages);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        marginTop: '14px',
        fontSize: '13px',
        color: 'var(--admin-text-secondary)',
      }}
    >
      <div>
        Showing <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{from}–{to}</span> of{' '}
        <span style={{ fontWeight: 600, color: 'var(--admin-text)' }}>{total}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {onPageSizeChange && (
          <select
            className="adm-select"
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            aria-label="Rows per page"
            style={{ width: 'auto', padding: '5px 8px', fontSize: '12px' }}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt} / page
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="adm-btn adm-btn-secondary adm-btn-sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span style={{ fontSize: '12px', color: 'var(--admin-text)', fontWeight: 600, minWidth: '56px', textAlign: 'center' }}>
          Page {page} / {safeTotalPages}
        </span>
        <button
          type="button"
          className="adm-btn adm-btn-secondary adm-btn-sm"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
