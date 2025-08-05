# Ruby SDK for Onboarding
# Use Courier's Ruby SDK for Rails applications

require 'trycourier'
require 'date'
require 'json'

class OnboardingService
  attr_reader :courier

  def initialize
    @courier = Courier::Client.new(
      auth_token: ENV['COURIER_AUTH_TOKEN']
    )
    
    @plan_configurations = {
      trial: {
        automation: 'trial-onboarding-flow',
        support_level: 'community',
        features: ['basic_features', 'email_support'],
        duration_days: 14
      },
      startup: {
        automation: 'startup-onboarding-flow',
        support_level: 'priority',
        features: ['all_features', 'priority_support', 'integrations'],
        duration_days: 30
      },
      enterprise: {
        automation: 'enterprise-onboarding-flow',
        support_level: 'dedicated',
        features: ['all_features', 'dedicated_support', 'sso', 'api_access'],
        duration_days: 90
      }
    }
  end

  # Create user and trigger onboarding
  def create_user_and_start_onboarding(user_data)
    user_id = user_data[:id]
    
    # Create/update Courier profile
    profile_data = {
      email: user_data[:email],
      name: user_data[:name],
      company: user_data[:company],
      plan: user_data[:plan],
      company_size: user_data[:company_size],
      signup_date: DateTime.now.iso8601,
      timezone: user_data[:timezone] || 'UTC',
      locale: user_data[:locale] || 'en',
      role: user_data[:role],
      industry: user_data[:industry]
    }
    
    @courier.profiles.merge(
      recipient_id: user_id,
      profile: profile_data
    )
    
    # Trigger onboarding automation
    plan_config = @plan_configurations[user_data[:plan].to_sym]
    
    @courier.automations.invoke(
      automation: plan_config[:automation],
      recipient: user_id,
      data: {
        user_name: user_data[:name],
        company_name: user_data[:company],
        features: plan_config[:features],
        onboarding_duration: plan_config[:duration_days]
      }
    )
    
    # Send welcome message
    send_welcome_message(user_id, user_data)
    
    # Create onboarding tasks
    create_onboarding_tasks(user_id, user_data[:plan])
    
    # Schedule follow-ups
    schedule_follow_ups(user_id, user_data[:plan])
    
    {
      user_id: user_id,
      status: 'onboarding_started',
      plan: user_data[:plan],
      expected_completion: DateTime.now + plan_config[:duration_days]
    }
  end

  # Send personalized welcome message
  def send_welcome_message(user_id, user_data)
    template_data = {
      user_name: user_data[:name],
      company_name: user_data[:company],
      getting_started_url: "https://app.example.com/onboarding/#{user_id}",
      support_email: get_support_email(user_data[:plan]),
      video_tutorial_url: 'https://example.com/tutorials/getting-started',
      calendar_link: user_data[:plan] == 'enterprise' ? 
        'https://calendly.com/success-team' : nil
    }
    
    @courier.send(
      message: {
        to: { user_id: user_id },
        template: 'welcome-message',
        data: template_data,
        channels: determine_channels(user_data[:plan])
      }
    )
  end

  # Create onboarding tasks in Inbox
  def create_onboarding_tasks(user_id, plan)
    tasks = [
      {
        id: 'complete-profile',
        title: 'Complete your profile',
        description: 'Add your photo and bio',
        priority: 1,
        estimated_time: '2 minutes',
        points: 10
      },
      {
        id: 'invite-team',
        title: 'Invite your first team member',
        description: 'Collaboration is better together',
        priority: 2,
        estimated_time: '5 minutes',
        points: 20
      },
      {
        id: 'create-project',
        title: 'Create your first project',
        description: 'Start organizing your work',
        priority: 3,
        estimated_time: '3 minutes',
        points: 30
      }
    ]
    
    # Add plan-specific tasks
    if plan == 'enterprise'
      tasks.unshift({
        id: 'schedule-onboarding',
        title: 'Schedule onboarding call',
        description: 'Get personalized guidance',
        priority: 0,
        estimated_time: '30 minutes',
        points: 50
      })
      
      tasks.push({
        id: 'configure-sso',
        title: 'Set up Single Sign-On',
        description: 'Enable secure team access',
        priority: 4,
        estimated_time: '15 minutes',
        points: 25
      })
    end
    
    tasks.each do |task|
      send_task_to_inbox(user_id, task)
    end
  end

  # Send individual task to Courier Inbox
  def send_task_to_inbox(user_id, task)
    due_date = DateTime.now + task[:priority] + 1
    
    @courier.send(
      message: {
        to: { user_id: user_id },
        template: 'onboarding-task',
        channels: ['inbox'],
        data: {
          task_id: task[:id],
          task_title: task[:title],
          task_description: task[:description],
          estimated_time: task[:estimated_time],
          points: task[:points],
          due_date: due_date.iso8601,
          action_url: "/tasks/#{task[:id]}"
        },
        metadata: {
          tags: ['onboarding', "priority-#{task[:priority]}"],
          utm: {
            source: 'onboarding',
            medium: 'inbox',
            campaign: 'user-activation'
          }
        }
      }
    )
  end

  # Track user progress and engagement
  def track_user_progress(user_id)
    profile = @courier.profiles.get(recipient_id: user_id)
    logs = @courier.logs.list(recipient: user_id, limit: 50)
    
    metrics = {
      user_id: user_id,
      days_since_signup: calculate_days_since(profile['signup_date']),
      engagement_score: 0,
      tasks_completed: 0,
      emails_opened: 0,
      last_activity: nil
    }
    
    # Analyze logs
    logs.each do |log|
      case log['channel']
      when 'email'
        metrics[:emails_opened] += 1 if log['opened_at']
      when 'inbox'
        metrics[:tasks_completed] += 1 if log['read_at']
      end
      
      metrics[:last_activity] = log['timestamp'] if log['timestamp']
    end
    
    # Calculate engagement score
    metrics[:engagement_score] = calculate_engagement_score(metrics, profile)
    
    # Check if intervention needed
    if needs_intervention?(metrics, profile)
      trigger_intervention(user_id, metrics, profile)
    end
    
    metrics
  end

  # Handle task completion
  def mark_task_complete(user_id, task_id)
    # Update profile with completion
    @courier.profiles.merge(
      recipient_id: user_id,
      profile: {
        "task_#{task_id}_completed": true,
        "task_#{task_id}_completed_at": DateTime.now.iso8601,
        onboarding_progress: calculate_progress(user_id)
      }
    )
    
    # Check for milestone celebrations
    check_and_celebrate_milestones(user_id, task_id)
    
    # Get next task
    next_task = get_next_task(user_id)
    
    # Send completion confirmation
    @courier.send(
      message: {
        to: { user_id: user_id },
        template: 'task-completed',
        channels: ['inbox'],
        data: {
          completed_task: task_id,
          next_task: next_task,
          progress: calculate_progress(user_id)
        }
      }
    )
  end

  # Schedule follow-up sequences
  def schedule_follow_ups(user_id, plan)
    follow_up_schedule = case plan
    when 'enterprise'
      [
        { delay: 1, template: 'enterprise-day-1' },
        { delay: 3, template: 'enterprise-day-3' },
        { delay: 7, template: 'enterprise-week-1' },
        { delay: 14, template: 'enterprise-week-2' },
        { delay: 30, template: 'enterprise-month-1' }
      ]
    when 'startup'
      [
        { delay: 2, template: 'startup-quick-wins' },
        { delay: 7, template: 'startup-week-1' },
        { delay: 14, template: 'startup-growth-tips' }
      ]
    else # trial
      [
        { delay: 1, template: 'trial-day-1' },
        { delay: 7, template: 'trial-halfway' },
        { delay: 12, template: 'trial-ending-soon' },
        { delay: 13, template: 'trial-last-chance' }
      ]
    end
    
    follow_up_schedule.each do |follow_up|
      schedule_message(user_id, follow_up[:template], follow_up[:delay])
    end
  end

  # Handle user milestones
  def check_and_celebrate_milestones(user_id, completed_task)
    milestones = {
      'create-project' => {
        template: 'first-project-celebration',
        reward: 'Pro feature unlocked',
        achievement: 'Quick Starter'
      },
      'invite-team' => {
        template: 'team-growth-celebration',
        reward: 'Collaboration guide',
        achievement: 'Team Builder'
      },
      'complete-profile' => {
        template: 'profile-complete-celebration',
        reward: 'Custom avatar frame',
        achievement: 'Profile Pro'
      }
    }
    
    if milestone = milestones[completed_task]
      @courier.send(
        message: {
          to: { user_id: user_id },
          template: milestone[:template],
          data: {
            achievement: milestone[:achievement],
            reward: milestone[:reward],
            share_url: "https://app.example.com/share/achievement/#{milestone[:achievement]}"
          },
          channels: ['email', 'inbox', 'push']
        }
      )
      
      # Update profile with achievement
      @courier.profiles.merge(
        recipient_id: user_id,
        profile: {
          achievements: [milestone[:achievement]],
          total_points: calculate_total_points(user_id)
        }
      )
    end
  end

  # Helper methods
  private

  def get_support_email(plan)
    case plan
    when 'enterprise'
      'enterprise-support@example.com'
    when 'startup'
      'priority-support@example.com'
    else
      'support@example.com'
    end
  end

  def determine_channels(plan)
    case plan
    when 'enterprise'
      ['email', 'sms', 'slack']
    when 'startup'
      ['email', 'inbox']
    else
      ['email']
    end
  end

  def calculate_days_since(date_string)
    return 0 unless date_string
    
    signup_date = DateTime.parse(date_string)
    (DateTime.now - signup_date).to_i
  end

  def calculate_engagement_score(metrics, profile)
    score = 0
    
    # Task completion (40 points max)
    score += [metrics[:tasks_completed] * 10, 40].min
    
    # Email engagement (30 points max)
    score += [metrics[:emails_opened] * 10, 30].min
    
    # Recency (30 points max)
    if metrics[:last_activity]
      days_inactive = calculate_days_since(metrics[:last_activity])
      score += case days_inactive
      when 0 then 30
      when 1..3 then 20
      when 4..7 then 10
      else 0
      end
    end
    
    score
  end

  def needs_intervention?(metrics, profile)
    return false if profile['plan'] == 'trial' # Let trial users explore
    
    metrics[:engagement_score] < 30 ||
      (metrics[:days_since_signup] > 7 && metrics[:tasks_completed] < 2) ||
      (metrics[:days_since_signup] > 3 && metrics[:last_activity].nil?)
  end

  def trigger_intervention(user_id, metrics, profile)
    if profile['plan'] == 'enterprise'
      # Escalate to Slack
      @courier.send(
        message: {
          to: {
            slack: {
              channel: '#customer-success',
              access_token: ENV['SLACK_TOKEN']
            }
          },
          template: 'enterprise-needs-help',
          data: {
            user_id: user_id,
            company: profile['company'],
            engagement_score: metrics[:engagement_score]
          }
        }
      )
    else
      # Send re-engagement email
      @courier.send(
        message: {
          to: { user_id: user_id },
          template: 're-engagement',
          data: metrics
        }
      )
    end
  end

  def calculate_progress(user_id)
    profile = @courier.profiles.get(recipient_id: user_id)
    
    tasks = ['complete-profile', 'invite-team', 'create-project']
    completed = tasks.count { |task| profile["task_#{task}_completed"] }
    
    (completed.to_f / tasks.length * 100).round
  end

  def get_next_task(user_id)
    profile = @courier.profiles.get(recipient_id: user_id)
    
    tasks = ['complete-profile', 'invite-team', 'create-project']
    tasks.find { |task| !profile["task_#{task}_completed"] }
  end

  def calculate_total_points(user_id)
    profile = @courier.profiles.get(recipient_id: user_id)
    
    points = 0
    task_points = {
      'complete-profile' => 10,
      'invite-team' => 20,
      'create-project' => 30
    }
    
    task_points.each do |task, value|
      points += value if profile["task_#{task}_completed"]
    end
    
    points
  end

  def schedule_message(user_id, template, days_delay)
    # This would integrate with a job scheduler like Sidekiq
    # ScheduledMessageJob.perform_in(days_delay.days, user_id, template)
    
    # For now, we'll just log it
    puts "Scheduled #{template} for #{user_id} in #{days_delay} days"
  end
end

# Rails controller example
class OnboardingController < ApplicationController
  before_action :authenticate_user!
  
  def create
    onboarding = OnboardingService.new
    
    result = onboarding.create_user_and_start_onboarding(
      id: current_user.id,
      email: current_user.email,
      name: current_user.name,
      company: current_user.company,
      plan: current_user.subscription_plan,
      company_size: current_user.company_size,
      role: current_user.role,
      industry: current_user.industry
    )
    
    render json: result
  end
  
  def complete_task
    onboarding = OnboardingService.new
    onboarding.mark_task_complete(current_user.id, params[:task_id])
    
    render json: { success: true }
  end
  
  def progress
    onboarding = OnboardingService.new
    metrics = onboarding.track_user_progress(current_user.id)
    
    render json: metrics
  end
end