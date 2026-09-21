import { motion } from 'framer-motion';
import { ArrowUpRightIcon, ArrowDownRightIcon, MinusIcon } from '@heroicons/react/24/solid';

const StatsCard = ({
  title,
  value,
  icon: Icon,
  subtext,
  trend,
  trendType = 'neutral', // 'positive' | 'negative' | 'neutral'
  color = 'blue',        // 'blue' | 'green' | 'orange' | 'red' | 'purple'
  loading = false,
  onClick,
}) => {
  
  // Clean Functional Icon Container Themes (Neutral cards with subtle accent icons)
  const iconThemes = {
    blue: {
      bg: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800',
    },
    green: {
      bg: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
    },
    orange: {
      bg: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
    },
    red: {
      bg: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    },
    purple: {
      bg: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800',
    },
  };

  const selectedIconTheme = iconThemes[color] || iconThemes.blue;

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs flex items-center justify-between animate-pulse w-full">
        <div className="space-y-3 flex-1">
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
          <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
        </div>
        <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-800 ml-4 flex-shrink-0" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs select-none transition-all duration-200 w-full relative overflow-hidden flex items-center justify-between group ${
        onClick ? 'cursor-pointer hover:border-slate-300 dark:hover:border-slate-700' : ''
      }`}
    >
      <div className="flex-1 min-w-0 pr-2">
        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider leading-tight">
          {title}
        </p>
        <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 tracking-tight tabular-nums break-words">
          {value}
        </h3>
        
        {(trend || subtext) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
            {trend && (
              <span
                className={`flex items-center gap-0.5 px-2 py-0.5 font-semibold rounded text-[11px] border tabular-nums ${
                  trendType === 'positive'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                    : trendType === 'negative'
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                    : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                {trendType === 'positive' && <ArrowUpRightIcon className="w-3 h-3" />}
                {trendType === 'negative' && <ArrowDownRightIcon className="w-3 h-3" />}
                {trendType === 'neutral' && <MinusIcon className="w-3 h-3" />}
                {trend}
              </span>
            )}
            {subtext && (
              <span className="text-slate-500 dark:text-slate-400 font-normal truncate text-[11px]">
                {subtext}
              </span>
            )}
          </div>
        )}
      </div>

      {Icon && (
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center border flex-shrink-0 ml-3 transition-transform group-hover:scale-105 ${selectedIconTheme.bg}`}
        >
          <Icon className="w-5 h-5" />
        </div>
      )}
    </motion.div>
  );
};

export default StatsCard;