"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

export default function usePagination(
  page: number,
  size: number,
  total: number
): Pagination {
  const router = useRouter();
  const searchParams = useSearchParams();

  return {
    page,
    pageSize: size,
    total,
    onPageChange: function (page: number): void {
      const next = new URLSearchParams();
      searchParams.forEach((val, key) => next.set(key, val));
      next.set("page", page.toString());
      router.replace(`?${next.toString()}`);
    },
    pageSizeOptions: [20, 50, 100],
    onPageSizeChange(pageSize) {
      const next = new URLSearchParams();
      searchParams.forEach((val, key) => next.set(key, val));
      next.set("size", pageSize.toString());
      next.delete("page"); // reset to first page
      router.replace(`?${next.toString()}`);
    },
  };
}
