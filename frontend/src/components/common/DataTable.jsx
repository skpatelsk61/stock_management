import { motion } from 'framer-motion';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

const DataTable = ({
  columns,
  data,
  actions,
  searchable = false,
  searchPlaceholder = 'Search...',
  itemsPerPage = 10,
  striped = true,
  tableClassName = '',
  className = '',
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = searchable
    ? data.filter((item) =>
        columns.some((col) =>
          String(item[col.key])
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        )
      )
    : data;

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-soft ${className}`}>
      {searchable && (
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-800">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-3.5 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-indigo-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
          />
        </div>
      )}

      <div className="overflow-x-auto scrollbar-thin">
        <table className={`w-full min-w-full text-left border-collapse text-xs ${tableClassName}`}>
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-3.5 py-3 text-left text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap ${col.headerClassName || ''}`}
                >
                  {col.label}
                </th>
              ))}
              {actions && (
                <th className="px-3.5 py-3 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-6 py-10 text-center text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/20"
                >
                  No items match the current report view
                </td>
              </tr>
            ) : (
              paginatedData.map((item, index) => (
                <motion.tr
                  key={item.id || index}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`border-b border-slate-100 dark:border-slate-800 transition-colors whitespace-nowrap ${
                    striped && index % 2 === 0
                      ? 'bg-slate-50/50 dark:bg-slate-850/40'
                      : 'bg-white dark:bg-slate-900'
                  } hover:bg-slate-100/60 dark:hover:bg-slate-800/60`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3.5 py-2.5 text-xs text-slate-800 dark:text-slate-200 whitespace-nowrap align-middle ${col.className || ''}`}
                    >
                      {col.render ? col.render(item[col.key], item) : item[col.key]}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-center align-middle">
                      <div className="flex items-center justify-center gap-1.5">
                        {actions.map((action, idx) => (
                          <button
                            key={idx}
                            onClick={() => action.handler(item)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${action.className || 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300'}`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filteredData.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center sm:text-left">
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of{' '}
            {filteredData.length}
          </span>
          {totalPages > 1 && (
            <div className="flex flex-wrap justify-center items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 sm:p-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
              >
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    page === currentPage
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 sm:p-2 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300"
              >
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataTable;
