'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { UserProfile, ProjectRole } from '@/lib/types';
import { formatRelativeTime } from '@/lib/utils';

export interface PresencePayload {
  user_id: string;
  email: string;
  full_name: string;
  avatar_url?: string | null;
  status: 'online' | 'away';
  current_path: string;
  online_at: string;
  last_active_at: string;
}

export interface TeamMemberPresence {
  id: string;
  name: string;
  email: string;
  role: ProjectRole;
  title: string;
  duty: string;
  initials: string;
  avatarColor: string;
  isOnline: boolean;
  status: 'online' | 'away' | 'offline';
  currentPath?: string | null;
  onlineAt?: string | null;
  lastActiveAt?: string | null;
  lastSeenAt?: string | null;
  isCurrentUser: boolean;
}

const KNOWN_DUTIES: Record<string, { duty: string; title: string; color: string }> = {
  '78d6ac01-5144-4327-a291-e703b27e103c': {
    title: 'Lead Systems Architect & Core Author',
    duty: 'Authoring Crash Consistency, Invariant Suites & Journal Testing',
    color: 'bg-purple-600',
  },
  '79e1aa71-7e62-44f4-883f-4be8fee1f57e': {
    title: 'Systems Engineering Co-Author',
    duty: 'Executing MFP Sync, Shell Extensions & Benchmark Cycles',
    color: 'bg-blue-600',
  },
  '1406aa55-3c12-49f7-adf6-a30fbfea7f42': {
    title: 'Academic Advisor & PFE Jury Evaluator',
    duty: 'Reviewing Verification Dossier & Formal PFE Defense Sign-Offs',
    color: 'bg-emerald-600',
  },
};

const PALETTE = [
  'bg-purple-600',
  'bg-blue-600',
  'bg-emerald-600',
  'bg-indigo-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-teal-600',
  'bg-cyan-600',
  'bg-violet-600',
];

function getInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.trim().slice(0, 2).toUpperCase();
  }
  if (email && email.trim()) {
    return email.trim().slice(0, 2).toUpperCase();
  }
  return 'TM';
}

function getAvatarColor(idOrEmail: string): string {
  let hash = 0;
  for (let i = 0; i < idOrEmail.length; i++) {
    hash = (hash << 5) - hash + idOrEmail.charCodeAt(i);
    hash |= 0;
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function formatActivityText(member: TeamMemberPresence): string {
  if (member.isOnline) {
    if (member.status === 'away') {
      return 'Away • Inactive in background';
    }
    if (member.currentPath) {
      const p = member.currentPath.toLowerCase();
      if (p.includes('/issues') || p.includes('/defects')) return 'Investigating Defects & Issues';
      if (p.includes('/suites') || p.includes('/cases')) return 'Authoring & Inspecting Test Suites';
      if (p.includes('/runs') || p.includes('/execute')) return 'Executing Test Verification Run';
      if (p.includes('/gates') || p.includes('/quality-gates')) return 'Reviewing Quality Gates & Sign-Offs';
      if (p.includes('/evidence')) return 'Auditing Execution Evidence & Traces';
      if (p.includes('/members')) return 'Managing Co-Op Engineering Roster';
      if (p.includes('/reports')) return 'Analyzing Test Coverage & Metrics';
      if (p.includes('/profile')) return 'Managing Engineer Account';
      if (p.includes('/new')) return 'Authoring Test Artifact';
      return 'Active in MorphFS Verification Workspace';
    }
    return member.duty || 'Active in MorphFS Verification Workspace';
  }

  // Offline
  if (member.lastSeenAt) {
    return `Last seen ${formatRelativeTime(member.lastSeenAt)}`;
  }
  return member.duty || 'Offline';
}

export function useProjectPresence(projectId?: string, user?: UserProfile | null) {
  const pathname = usePathname();
  const supabase = React.useMemo(() => createClient(), []);

  const [dbMembers, setDbMembers] = React.useState<any[]>([]);
  const [presenceStateMap, setPresenceStateMap] = React.useState<Record<string, PresencePayload[]>>({});
  const [isConnected, setIsConnected] = React.useState(false);

  const userStatusRef = React.useRef<'online' | 'away'>('online');
  const onlineAtRef = React.useRef<string>(new Date().toISOString());
  const channelRef = React.useRef<any>(null);
  const userRef = React.useRef(user);

  React.useEffect(() => {
    userRef.current = user;
  }, [user]);

  // 1. Fetch project members & profiles from DB
  const loadMembers = React.useCallback(async () => {
    if (!projectId) return;

    try {
      // Resolve UUID if projectId is key (like "MORPH")
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);
      let resolvedId = projectId;

      if (!isUuid) {
        const { data: p } = await supabase
          .from('projects')
          .select('id')
          .ilike('key', projectId)
          .maybeSingle();
        if (p?.id) resolvedId = p.id;
      }

      const { data: mData } = await supabase
        .from('project_members')
        .select('id, user_id, role, created_at')
        .eq('project_id', resolvedId);

      const currentUser = userRef.current;
      const userIds = (mData || []).map((m: any) => m.user_id);
      if (currentUser?.id && !userIds.includes(currentUser.id)) {
        userIds.push(currentUser.id);
      }

      const { data: pData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);

      const list = (mData || []).map((m: any) => {
        const profile = (pData || []).find((p: any) => p.id === m.user_id);
        return {
          id: m.user_id,
          member_id: m.id,
          role: m.role,
          created_at: m.created_at,
          profile,
        };
      });

      // Ensure current user is present if they belong to project
      if (currentUser?.id && !list.some((item) => item.id === currentUser.id)) {
        const profile = (pData || []).find((p: any) => p.id === currentUser.id) || {
          id: currentUser.id,
          email: currentUser.email,
          full_name: currentUser.full_name,
          role_title: currentUser.role_title,
          updated_at: new Date().toISOString(),
        };
        list.push({
          id: currentUser.id,
          member_id: 'current-session',
          role: 'admin',
          created_at: new Date().toISOString(),
          profile,
        });
      }

      setDbMembers(list);
    } catch (err) {
      console.error('Error loading project members for presence:', err);
    }
  }, [projectId, supabase]);

  React.useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  // 2. Realtime Presence Subscription
  React.useEffect(() => {
    if (!projectId) return;

    const currentUserId = user?.id;
    // Use unified project channel
    const channelName = `presence:project:${projectId.toLowerCase()}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUserId || `anon-${Math.random().toString(36).substring(2, 9)}`,
        },
      },
    });

    channelRef.current = channel;

    const trackCurrentPresence = async (status: 'online' | 'away') => {
      const u = userRef.current;
      if (!u?.id) return;
      try {
        await channel.track({
          user_id: u.id,
          email: u.email,
          full_name: u.full_name || 'Collaborator',
          avatar_url: u.avatar_url || null,
          status,
          current_path: typeof window !== 'undefined' ? window.location.pathname : '',
          online_at: onlineAtRef.current,
          last_active_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Failed to track presence:', err);
      }
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, PresencePayload[]>;
        setPresenceStateMap(state);
        setIsConnected(true);
      })
      .on('presence', { event: 'join' }, () => {
        const state = channel.presenceState() as Record<string, PresencePayload[]>;
        setPresenceStateMap(state);
      })
      .on('presence', { event: 'leave' }, () => {
        const state = channel.presenceState() as Record<string, PresencePayload[]>;
        setPresenceStateMap(state);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          await trackCurrentPresence(userStatusRef.current);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [projectId, user?.id, supabase]);

  // 3. User Activity & Inactivity Tracking (Like Slack / Discord / Linear)
  React.useEffect(() => {
    if (!user?.id) return;

    let idleTimeoutId: NodeJS.Timeout;
    const IDLE_DELAY_MS = 150000; // 2.5 minutes of complete inactivity -> Away

    const updatePresence = (status: 'online' | 'away') => {
      if (userStatusRef.current === status) return;
      userStatusRef.current = status;
      const u = userRef.current;
      if (channelRef.current && isConnected && u?.id) {
        channelRef.current.track({
          user_id: u.id,
          email: u.email,
          full_name: u.full_name || 'Collaborator',
          avatar_url: u.avatar_url || null,
          status,
          current_path: typeof window !== 'undefined' ? window.location.pathname : '',
          online_at: onlineAtRef.current,
          last_active_at: new Date().toISOString(),
        });
      }
    };

    const handleActivity = () => {
      if (userStatusRef.current === 'away') {
        updatePresence('online');
      }

      clearTimeout(idleTimeoutId);
      idleTimeoutId = setTimeout(() => {
        updatePresence('away');
      }, IDLE_DELAY_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('away');
      } else {
        updatePresence('online');
      }
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('click', handleActivity, { passive: true });
    window.addEventListener('scroll', handleActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    idleTimeoutId = setTimeout(() => {
      updatePresence('away');
    }, IDLE_DELAY_MS);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(idleTimeoutId);
    };
  }, [user?.id, isConnected]);

  // 4. Update path in presence when user navigates
  React.useEffect(() => {
    const u = userRef.current;
    if (!u?.id || !channelRef.current || !isConnected) return;
    channelRef.current.track({
      user_id: u.id,
      email: u.email,
      full_name: u.full_name || 'Collaborator',
      avatar_url: u.avatar_url || null,
      status: userStatusRef.current,
      current_path: pathname || '',
      online_at: onlineAtRef.current,
      last_active_at: new Date().toISOString(),
    });
  }, [pathname, isConnected, user?.id]);

  // 5. Database Heartbeat (keeps profiles.updated_at fresh for accurate "last seen")
  React.useEffect(() => {
    if (!user?.id) return;

    const recordHeartbeat = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', user.id);
      } catch (err) {
        // silent
      }
    };

    recordHeartbeat();
    const interval = setInterval(recordHeartbeat, 180000); // Every 3 minutes
    return () => clearInterval(interval);
  }, [user?.id, supabase]);

  // 6. Compute resolved members with live presence
  const resolvedMembers: TeamMemberPresence[] = React.useMemo(() => {
    // If no db members loaded yet, use known defaults so UI never flickers empty
    const sourceList =
      dbMembers.length > 0
        ? dbMembers
        : [
            {
              id: '78d6ac01-5144-4327-a291-e703b27e103c',
              role: 'owner',
              profile: {
                id: '78d6ac01-5144-4327-a291-e703b27e103c',
                full_name: 'Ahmed Affes',
                email: 'ahmedaffes@gmail.com',
                role_title: 'Lead Systems Architect & Core Author',
                updated_at: new Date().toISOString(),
              },
            },
            {
              id: '79e1aa71-7e62-44f4-883f-4be8fee1f57e',
              role: 'owner',
              profile: {
                id: '79e1aa71-7e62-44f4-883f-4be8fee1f57e',
                full_name: 'Wacim Abdelli',
                email: 'wacimabdelli@gmail.com',
                role_title: 'Systems Engineering Co-Author',
                updated_at: '2026-09-25T23:01:17.371Z',
              },
            },
            {
              id: '1406aa55-3c12-49f7-adf6-a30fbfea7f42',
              role: 'viewer',
              profile: {
                id: '1406aa55-3c12-49f7-adf6-a30fbfea7f42',
                full_name: 'Prof. Academic Advisor',
                email: 'professor@morphfs.dev',
                role_title: 'Academic Advisor & PFE Jury Evaluator',
                updated_at: '2026-09-25T20:24:03.232Z',
              },
            },
          ];

    return sourceList.map((item) => {
      const id = item.id;
      const profile = item.profile || {};
      const known = KNOWN_DUTIES[id];

      const name = profile.full_name || known?.title || 'Team Member';
      const email = profile.email || 'engineer@morphfs.dev';
      const role = (item.role || 'tester') as ProjectRole;
      const title = profile.role_title || known?.title || 'Systems Engineer';
      const duty = known?.duty || profile.role_title || 'Systems Engineering & Quality Verification';
      const initials = getInitials(name, email);
      const avatarColor = known?.color || getAvatarColor(id || email);

      const isCurrentUser = Boolean(user?.id && (user.id === id || user.email === email));

      // Check active Realtime presence state
      // Presence key in Supabase can match user_id or presence entry user_id
      const presencesForUser =
        presenceStateMap[id] ||
        Object.values(presenceStateMap)
          .flat()
          .filter((p) => p.user_id === id || (email && p.email?.toLowerCase() === email.toLowerCase()));

      let isOnline = false;
      let status: 'online' | 'away' | 'offline' = 'offline';
      let currentPath: string | null = null;
      let onlineAt: string | null = null;
      let lastActiveAt: string | null = null;

      if (presencesForUser.length > 0) {
        const latestPresence = presencesForUser[0];
        isOnline = true;
        status = latestPresence.status || 'online';
        currentPath = latestPresence.current_path || null;
        onlineAt = latestPresence.online_at || null;
        lastActiveAt = latestPresence.last_active_at || null;
      } else if (isCurrentUser && isConnected) {
        // Fallback for self while socket initializes
        isOnline = true;
        status = userStatusRef.current || 'online';
        currentPath = pathname || null;
        onlineAt = onlineAtRef.current;
        lastActiveAt = new Date().toISOString();
      }

      const lastSeenAt = isOnline
        ? null
        : profile.updated_at || item.created_at || '2026-09-25T20:23:02.990Z';

      return {
        id,
        name,
        email,
        role,
        title,
        duty,
        initials,
        avatarColor,
        isOnline,
        status,
        currentPath,
        onlineAt,
        lastActiveAt,
        lastSeenAt,
        isCurrentUser,
      };
    });
  }, [dbMembers, presenceStateMap, user?.id, user?.email, isConnected, pathname]);

  const onlineMembers = React.useMemo(
    () => resolvedMembers.filter((m) => m.isOnline),
    [resolvedMembers]
  );

  return {
    members: resolvedMembers,
    onlineMembers,
    onlineCount: onlineMembers.length,
    isConnected,
    refreshMembers: loadMembers,
  };
}
