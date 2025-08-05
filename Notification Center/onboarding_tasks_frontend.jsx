// Frontend: Onboarding Tasks React Component
// Display and manage tasks in Courier Inbox

import React, { useState, useEffect } from 'react';
import { Inbox, useInbox } from "@trycourier/react-inbox";
import { CourierProvider } from "@trycourier/react-provider";

// Main Onboarding Tasks Component
function OnboardingTasks() {
  const [filter, setFilter] = useState('all');
  const [progress, setProgress] = useState(0);
  
  return (
    <div className="onboarding-container">
      <OnboardingProgress progress={progress} />
      <TaskFilters filter={filter} setFilter={setFilter} />
      
      <Inbox
        views={[
          {
            id: "onboarding",
            label: "Setup Tasks",
            params: { tags: ["onboarding"] }
          },
          {
            id: "pending",
            label: "To Do",
            params: { status: "unread", tags: ["onboarding"] }
          },
          {
            id: "completed",
            label: "Completed",
            params: { status: "read", tags: ["onboarding"] }
          },
          {
            id: "priority",
            label: "Priority",
            params: { tags: ["onboarding", "priority-0", "priority-1", "priority-2"] }
          }
        ]}
        onMessageClick={(message) => {
          // Navigate to task action
          if (message.data?.action_url) {
            window.location.href = message.data.action_url;
          }
          // Mark as completed
          message.markAsRead();
          // Update progress
          updateProgress();
        }}
        renderMessage={(message) => (
          <TaskCard message={message} />
        )}
      />
    </div>
  );
}

// Task Card Component
function TaskCard({ message }) {
  const [expanded, setExpanded] = useState(false);
  const isCompleted = message.read;
  
  return (
    <div className={`task-card ${isCompleted ? 'completed' : 'pending'}`}>
      <div className="task-header" onClick={() => setExpanded(!expanded)}>
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={(e) => {
            e.stopPropagation();
            if (!isCompleted) {
              message.markAsRead();
            } else {
              message.markAsUnread();
            }
          }}
        />
        <div className="task-content">
          <h3 className={isCompleted ? 'task-title completed' : 'task-title'}>
            {message.title}
          </h3>
          {message.data?.estimated_time && (
            <span className="task-time">⏱ {message.data.estimated_time}</span>
          )}
          {message.data?.points && (
            <span className="task-points">+{message.data.points} points</span>
          )}
        </div>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>
      
      {expanded && (
        <div className="task-details">
          <p>{message.data?.description}</p>
          {message.data?.due_date && (
            <p className="due-date">Due: {new Date(message.data.due_date).toLocaleDateString()}</p>
          )}
          <button 
            className="action-button"
            onClick={() => window.location.href = message.data?.action_url}
          >
            Start Task →
          </button>
        </div>
      )}
    </div>
  );
}

// Progress Bar Component
function OnboardingProgress({ progress }) {
  const { messages } = useInbox();
  const [calculatedProgress, setCalculatedProgress] = useState(0);
  
  useEffect(() => {
    const onboardingMessages = messages.filter(msg => 
      msg.metadata?.tags?.includes('onboarding')
    );
    const completedTasks = onboardingMessages.filter(msg => msg.read).length;
    const totalTasks = onboardingMessages.length;
    
    if (totalTasks > 0) {
      setCalculatedProgress(Math.round((completedTasks / totalTasks) * 100));
    }
  }, [messages]);
  
  return (
    <div className="progress-container">
      <div className="progress-header">
        <h2>Your Onboarding Progress</h2>
        <span className="progress-percentage">{calculatedProgress}%</span>
      </div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${calculatedProgress}%` }}
        />
      </div>
      {calculatedProgress === 100 && (
        <div className="completion-message">
          🎉 Congratulations! You've completed onboarding!
        </div>
      )}
    </div>
  );
}

// Task Filters Component
function TaskFilters({ filter, setFilter }) {
  const filters = [
    { id: 'all', label: 'All Tasks', icon: '📋' },
    { id: 'setup', label: 'Setup', icon: '⚙️' },
    { id: 'team', label: 'Team', icon: '👥' },
    { id: 'activation', label: 'Activation', icon: '🚀' },
    { id: 'learning', label: 'Learning', icon: '📚' }
  ];
  
  return (
    <div className="task-filters">
      {filters.map(f => (
        <button
          key={f.id}
          className={`filter-button ${filter === f.id ? 'active' : ''}`}
          onClick={() => setFilter(f.id)}
        >
          <span className="filter-icon">{f.icon}</span>
          <span className="filter-label">{f.label}</span>
        </button>
      ))}
    </div>
  );
}

// Main App Component with Provider
function OnboardingApp({ userId, clientKey }) {
  return (
    <CourierProvider
      userId={userId}
      clientKey={clientKey}
    >
      <OnboardingTasks />
    </CourierProvider>
  );
}

// Gamification Component
function OnboardingGamification() {
  const { messages } = useInbox();
  const [totalPoints, setTotalPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [achievements, setAchievements] = useState([]);
  
  useEffect(() => {
    const completedTasks = messages.filter(msg => 
      msg.metadata?.tags?.includes('onboarding') && msg.read
    );
    
    const points = completedTasks.reduce((sum, task) => 
      sum + (task.data?.points || 0), 0
    );
    
    setTotalPoints(points);
    setLevel(Math.floor(points / 50) + 1);
    
    // Check for achievements
    const newAchievements = [];
    if (completedTasks.length >= 1) newAchievements.push('First Step');
    if (completedTasks.length >= 5) newAchievements.push('Half Way There');
    if (completedTasks.length >= 10) newAchievements.push('Onboarding Master');
    
    setAchievements(newAchievements);
  }, [messages]);
  
  return (
    <div className="gamification-panel">
      <div className="points-display">
        <span className="points-icon">⭐</span>
        <span className="points-value">{totalPoints} points</span>
      </div>
      <div className="level-display">
        <span className="level-label">Level {level}</span>
        <div className="level-progress">
          <div 
            className="level-fill" 
            style={{ width: `${(totalPoints % 50) * 2}%` }}
          />
        </div>
      </div>
      {achievements.length > 0 && (
        <div className="achievements">
          <h3>Achievements</h3>
          {achievements.map(achievement => (
            <div key={achievement} className="achievement-badge">
              🏆 {achievement}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { OnboardingApp, OnboardingTasks, OnboardingGamification, TaskCard };