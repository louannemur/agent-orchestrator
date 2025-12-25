"use client";

import { memo, ReactNode } from "react";

// ============================================================================
// Responsive Table Wrapper
// ============================================================================

interface ResponsiveTableProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper for tables that makes them horizontally scrollable on mobile.
 */
export const ResponsiveTable = memo(function ResponsiveTable({
  children,
  className = "",
}: ResponsiveTableProps) {
  return (
    <div
      className={`-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0 ${className}`}
      role="region"
      aria-label="Scrollable table"
      tabIndex={0}
    >
      <div className="inline-block min-w-full align-middle">{children}</div>
    </div>
  );
});

// ============================================================================
// Mobile Card View for Tables
// ============================================================================

interface MobileCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Card-style display for table rows on mobile.
 * Use in place of table rows on smaller screens.
 */
export const MobileCard = memo(function MobileCard({
  children,
  className = "",
}: MobileCardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-800 bg-zinc-900 p-4 ${className}`}
    >
      {children}
    </div>
  );
});

// ============================================================================
// Mobile Card Field
// ============================================================================

interface MobileFieldProps {
  label: string;
  children: ReactNode;
  className?: string;
}

/**
 * Labeled field for mobile card views.
 */
export const MobileField = memo(function MobileField({
  label,
  children,
  className = "",
}: MobileFieldProps) {
  return (
    <div className={`flex items-center justify-between py-1 ${className}`}>
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-100">{children}</span>
    </div>
  );
});

// ============================================================================
// Responsive List
// ============================================================================

interface ResponsiveListProps<T> {
  items: T[];
  renderTableRow: (item: T, index: number) => ReactNode;
  renderMobileCard: (item: T, index: number) => ReactNode;
  tableHeader: ReactNode;
  emptyState?: ReactNode;
  className?: string;
}

/**
 * Renders a table on desktop and cards on mobile.
 */
export function ResponsiveList<T>({
  items,
  renderTableRow,
  renderMobileCard,
  tableHeader,
  emptyState,
  className = "",
}: ResponsiveListProps<T>) {
  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className={className}>
      {/* Desktop Table */}
      <div className="hidden md:block">
        <ResponsiveTable>
          <table className="min-w-full">
            <thead>{tableHeader}</thead>
            <tbody className="divide-y divide-zinc-800">
              {items.map((item, index) => renderTableRow(item, index))}
            </tbody>
          </table>
        </ResponsiveTable>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 md:hidden">
        {items.map((item, index) => renderMobileCard(item, index))}
      </div>
    </div>
  );
}

// ============================================================================
// Pagination Component
// ============================================================================

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = "",
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = [];
  const showEllipsisStart = currentPage > 3;
  const showEllipsisEnd = currentPage < totalPages - 2;

  // Always show first page
  pages.push(1);

  if (showEllipsisStart) {
    pages.push("...");
  }

  // Show pages around current
  for (
    let i = Math.max(2, currentPage - 1);
    i <= Math.min(totalPages - 1, currentPage + 1);
    i++
  ) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  if (showEllipsisEnd) {
    pages.push("...");
  }

  // Always show last page
  if (totalPages > 1 && !pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return (
    <nav
      className={`flex items-center justify-center gap-1 ${className}`}
      aria-label="Pagination"
    >
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Previous page"
      >
        Previous
      </button>

      <div className="flex items-center gap-1">
        {pages.map((page, index) =>
          page === "..." ? (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-zinc-500"
              aria-hidden="true"
            >
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`min-w-[2.5rem] rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                currentPage === page
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              }`}
              aria-current={currentPage === page ? "page" : undefined}
            >
              {page}
            </button>
          )
        )}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Next page"
      >
        Next
      </button>
    </nav>
  );
});

// ============================================================================
// Page Size Selector
// ============================================================================

interface PageSizeSelectorProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  options?: number[];
  className?: string;
}

export const PageSizeSelector = memo(function PageSizeSelector({
  pageSize,
  onPageSizeChange,
  options = [10, 25, 50, 100],
  className = "",
}: PageSizeSelectorProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor="page-size" className="text-sm text-zinc-400">
        Show
      </label>
      <select
        id="page-size"
        value={pageSize}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
        className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {options.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <span className="text-sm text-zinc-400">per page</span>
    </div>
  );
});
