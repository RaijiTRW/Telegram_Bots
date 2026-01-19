'use client';

import { useState } from 'react';
import AIManagementContent from './AIManagementContent';
import AISettingsContent from './AISettingsContent';

type TabType = 'channels' | 'settings';

export default function AISettingsTabs() {
  const [activeTab, setActiveTab] = useState<TabType>('channels');

  const tabs = [
    { id: 'channels' as TabType, label: 'Каналы', icon: '📺' },
    { id: 'settings' as TabType, label: 'Настройки AI', icon: '⚙️' },
  ];

  return (
    <div>
      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '32px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              fontSize: '15px',
              fontWeight: '500',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-secondary)',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-1px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'channels' && <AIManagementContent />}
        {activeTab === 'settings' && <AISettingsContent />}
      </div>
    </div>
  );
}
