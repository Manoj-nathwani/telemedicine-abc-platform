import React, { createContext, useContext } from 'react';
import { useQuery } from 'wasp/client/operations';
import { getConfig } from 'wasp/client/operations';
import { Loading } from '../components/Loading';

const ConfigContext = createContext<{
  consultationDurationMinutes: number;
  breakDurationMinutes: number;
  bufferTimeMinutes: number;
  consultationSmsTemplates: Array<{ name: string; body: string }>;
} | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: config, isLoading, error } = useQuery(getConfig);

  if (isLoading) return <Loading />;
  if (error || !config) return <div className="text-danger p-4">Failed to load configuration.</div>;

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) throw new Error('useConfig must be used within a ConfigProvider');
  return context;
}; 