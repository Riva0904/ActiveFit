import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import Button from '../ui/button';

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  limit?: number;
}

const Pagination: React.FC<Props> = ({ page, totalPages, onPageChange, total, limit }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
      {total !== undefined && limit !== undefined && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total}
        </p>
      )}
      <div className="flex items-center gap-2 ml-auto">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <FiChevronLeft />
        </Button>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Page {page} of {totalPages}
        </span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <FiChevronRight />
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
