import { useState, useCallback } from 'react';
import TopBar from './components/TopBar';
import LeftSidebar from './components/LeftSidebar';
import ChatCockpit from './components/ChatCockpit';
import RightSidebar from './components/RightSidebar';
import { useHarness } from './hooks/useHarness';

export default function App() {
  const { status, positions, trades, markets, feed, sendCommand, runCycle, toggleAutoLoop } = useHarness();
  const [selectedChannel, setSelectedChannel] = useState<string>('command');
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  const toggleLeftSidebar = useCallback(() => {
    setLeftSidebarOpen(prev => !prev);
    setRightSidebarOpen(false);
  }, []);

  const toggleRightSidebar = useCallback(() => {
    setRightSidebarOpen(prev => !prev);
    setLeftSidebarOpen(false);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col bg-bg overflow-hidden">
      {/* Top Bar */}
      <TopBar
        status={status}
        onRunCycle={runCycle}
        onToggleAutoLoop={toggleAutoLoop}
        onToggleLeftSidebar={toggleLeftSidebar}
        onToggleRightSidebar={toggleRightSidebar}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Overlay */}
        {(leftSidebarOpen || rightSidebarOpen) && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-20"
            onClick={() => { setLeftSidebarOpen(false); setRightSidebarOpen(false); }}
          />
        )}

        {/* Left Sidebar - Positions, Trades, Markets */}
        <div className={`
          ${leftSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:relative
          fixed left-0 top-0 h-full z-30
          transition-transform duration-300 ease-in-out
          lg:block
        `}>
          <LeftSidebar
            positions={positions}
            trades={trades}
            markets={markets}
            onClose={() => setLeftSidebarOpen(false)}
          />
        </div>

        {/* Center - Chat Cockpit */}
        <ChatCockpit
          selectedChannel={selectedChannel}
          onChannelChange={setSelectedChannel}
          onCommand={sendCommand}
          status={status}
        />

        {/* Right Sidebar - Feed */}
        <div className={`
          ${rightSidebarOpen ? 'translate-x-0' : 'translate-x-full'}
          lg:translate-x-0 lg:relative
          fixed right-0 top-0 h-full z-30
          transition-transform duration-300 ease-in-out
          lg:block
        `}>
          <RightSidebar
            feed={feed}
            onClose={() => setRightSidebarOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
