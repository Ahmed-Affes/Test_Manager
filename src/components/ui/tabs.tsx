'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [internalTab, setInternalTab] = React.useState(defaultValue || '');
  const activeTab = value !== undefined ? value : internalTab;

  const setActiveTab = React.useCallback(
    (newTab: string) => {
      if (onValueChange) {
        onValueChange(newTab);
      } else {
        setInternalTab(newTab);
      }
    },
    [onValueChange]
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'inline-flex h-9 items-center justify-start rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-1 text-zinc-500 dark:text-zinc-400 gap-1 border border-zinc-200/60 dark:border-zinc-750',
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsTrigger must be used within Tabs');

  const isActive = context.activeTab === value;

  return (
    <button
      type="button"
      onClick={() => context.setActiveTab(value)}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50',
        isActive
          ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-900 dark:text-zinc-50 font-semibold'
          : 'hover:text-zinc-900 dark:hover:text-zinc-100',
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');

  if (context.activeTab !== value) return null;

  return (
    <div
      className={cn(
        'mt-3 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400',
        className
      )}
    >
      {children}
    </div>
  );
}
