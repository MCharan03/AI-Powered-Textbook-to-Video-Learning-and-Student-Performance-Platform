import React from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  emptyMessage = 'No records found.',
  onRowClick,
}: DataTableProps<T>) {
  const isDark = document.body.className.includes('theme-admin');

  return (
    <div
      style={{
        width: '100%',
        overflowX: 'auto',
        borderRadius: '10px',
        border: `1px solid ${isDark ? 'var(--admin-border)' : 'var(--learn-border)'}`,
        backgroundColor: isDark ? 'var(--admin-surface)' : 'var(--learn-surface)',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
        <thead>
          <tr
            style={{
              borderBottom: `1px solid ${isDark ? 'var(--admin-border)' : 'var(--learn-border)'}`,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '14px 16px',
                  fontWeight: 600,
                  color: isDark ? 'var(--admin-text-secondary)' : 'var(--learn-text-secondary)',
                  width: col.width,
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: isDark ? 'var(--admin-text-secondary)' : 'var(--learn-text-secondary)',
                }}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                onClick={() => onRowClick && onRowClick(row)}
                style={{
                  borderBottom: `1px solid ${isDark ? 'var(--admin-border)' : 'var(--learn-border)'}`,
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'background-color 100ms ease',
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '14px 16px',
                      color: isDark ? 'var(--admin-text)' : 'var(--learn-text)',
                    }}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
