import React from 'react';

const PageContentSkeleton = () => {
  return (
    <div className="w-full flex-1 flex flex-col gap-6 animate-pulse select-none">
      {/* Top Header Placeholder */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
          <div className="h-3 w-64 bg-slate-150 dark:bg-slate-850 rounded" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          <div className="h-9 w-32 bg-indigo-200/60 dark:bg-indigo-900/40 rounded-xl" />
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between"
          >
            <div className="space-y-2.5 flex-1">
              <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
              <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
              <div className="h-3 bg-slate-150 dark:bg-slate-850 rounded w-1/3" />
            </div>
            <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-800 ml-3" />
          </div>
        ))}
      </div>

      {/* Filter / Search Bar Placeholder */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="h-9 bg-slate-100 dark:bg-slate-800 rounded-xl sm:col-span-2" />
          <div className="h-9 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-9 bg-slate-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-9 bg-slate-100 dark:bg-slate-800 rounded-xl" />
        </div>
      </div>

      {/* Table Placeholder */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs flex-1 min-h-[360px] p-4 flex flex-col gap-3">
        {/* Table Header */}
        <div className="h-10 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full" />
        {/* Table Rows */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-slate-800/50">
            <div className="h-4 w-6 bg-slate-150 dark:bg-slate-850 rounded" />
            <div className="h-4 w-36 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-24 bg-slate-150 dark:bg-slate-850 rounded ml-auto" />
            <div className="h-4 w-20 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="h-4 w-16 bg-slate-150 dark:bg-slate-850 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default PageContentSkeleton;
