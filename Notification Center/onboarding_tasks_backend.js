// Backend: Onboarding Tasks Management
// Send onboarding tasks to Courier Inbox

const createOnboardingTasks = async (courier, userId, userPlan) => {
  const baseTasks = [
    {
      id: "complete-profile",
      title: "Complete your profile",
      description: "Add your photo and bio to help your team recognize you",
      priority: 1,
      action_url: "/settings/profile",
      estimated_time: "2 minutes",
      category: "setup"
    },
    {
      id: "invite-team",
      title: "Invite your first team member",
      description: "Collaboration is better together - invite your team",
      priority: 2,
      action_url: "/team/invite",
      estimated_time: "5 minutes",
      category: "team"
    },
    {
      id: "create-project",
      title: "Create your first project",
      description: "Start organizing your work in a project",
      priority: 3,
      action_url: "/projects/new",
      estimated_time: "3 minutes",
      category: "activation"
    },
    {
      id: "connect-integration",
      title: "Connect your first integration",
      description: "Sync with tools you already use",
      priority: 4,
      action_url: "/integrations",
      estimated_time: "5 minutes",
      category: "setup"
    },
    {
      id: "customize-workspace",
      title: "Customize your workspace",
      description: "Make TeamSync feel like home",
      priority: 5,
      action_url: "/settings/workspace",
      estimated_time: "3 minutes",
      category: "personalization"
    }
  ];

  // Add plan-specific tasks
  const planSpecificTasks = {
    enterprise: [
      {
        id: "schedule-onboarding",
        title: "Schedule onboarding call with success team",
        description: "Get personalized guidance from our experts",
        priority: 0,
        action_url: "/schedule-demo",
        estimated_time: "30 minutes",
        category: "support"
      },
      {
        id: "setup-sso",
        title: "Configure Single Sign-On",
        description: "Enable secure team access with your identity provider",
        priority: 1,
        action_url: "/settings/sso",
        estimated_time: "15 minutes",
        category: "security"
      },
      {
        id: "review-compliance",
        title: "Review compliance documentation",
        description: "Ensure TeamSync meets your security requirements",
        priority: 2,
        action_url: "/compliance",
        estimated_time: "10 minutes",
        category: "security"
      }
    ],
    startup: [
      {
        id: "join-community",
        title: "Join our startup community",
        description: "Connect with other growing teams",
        priority: 6,
        action_url: "/community",
        estimated_time: "2 minutes",
        category: "community"
      },
      {
        id: "explore-templates",
        title: "Explore project templates",
        description: "Start faster with pre-built workflows",
        priority: 7,
        action_url: "/templates",
        estimated_time: "5 minutes",
        category: "productivity"
      }
    ],
    trial: [
      {
        id: "watch-demo",
        title: "Watch 5-minute product tour",
        description: "See TeamSync in action",
        priority: 0,
        action_url: "/demo-video",
        estimated_time: "5 minutes",
        category: "learning"
      },
      {
        id: "explore-pricing",
        title: "Explore pricing options",
        description: "Find the right plan for your team",
        priority: 8,
        action_url: "/pricing",
        estimated_time: "3 minutes",
        category: "upgrade"
      }
    ]
  };

  const tasks = [...baseTasks, ...(planSpecificTasks[userPlan] || [])];
  
  // Sort tasks by priority
  tasks.sort((a, b) => a.priority - b.priority);

  // Send tasks to Inbox with metadata
  for (const task of tasks) {
    await courier.send({
      message: {
        template: "onboarding-task",
        to: { user_id: userId },
        channels: ["inbox"],
        data: {
          ...task,
          due_date: calculateDueDate(task.priority),
          points: calculatePoints(task.category)
        },
        metadata: {
          tags: ["onboarding", `priority-${task.priority}`, `category-${task.category}`],
          utm: {
            source: "onboarding",
            medium: "inbox",
            campaign: `${userPlan}-onboarding`
          }
        }
      }
    });
  }

  return tasks;
};

// Helper functions
const calculateDueDate = (priority) => {
  const now = new Date();
  const daysToAdd = priority <= 2 ? 1 : priority <= 5 ? 3 : 7;
  now.setDate(now.getDate() + daysToAdd);
  return now.toISOString();
};

const calculatePoints = (category) => {
  const pointsMap = {
    setup: 10,
    team: 20,
    activation: 30,
    security: 15,
    personalization: 5,
    community: 10,
    productivity: 15,
    support: 25,
    learning: 10,
    upgrade: 5
  };
  return pointsMap[category] || 10;
};

// Track task completion
const trackTaskCompletion = async (courier, userId, taskId) => {
  // Update user profile with completion
  await courier.profiles.merge({
    recipientId: userId,
    profile: {
      [`task_${taskId}_completed`]: true,
      [`task_${taskId}_completed_at`]: new Date().toISOString(),
      onboarding_progress: await calculateProgress(courier, userId)
    }
  });

  // Send completion event
  await courier.send({
    message: {
      template: "task-completed",
      to: { user_id: userId },
      channels: ["inbox"],
      data: {
        task_id: taskId,
        next_task: await getNextTask(courier, userId)
      }
    }
  });
};

const calculateProgress = async (courier, userId) => {
  const profile = await courier.profiles.get(userId);
  const totalTasks = 8; // Base tasks count
  let completedTasks = 0;
  
  for (let i = 0; i < totalTasks; i++) {
    if (profile[`task_completed_${i}`]) {
      completedTasks++;
    }
  }
  
  return Math.round((completedTasks / totalTasks) * 100);
};

const getNextTask = async (courier, userId) => {
  // Logic to determine next uncompleted task
  // Implementation depends on your specific needs
  return null;
};

export { createOnboardingTasks, trackTaskCompletion, calculateProgress };