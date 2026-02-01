
export enum UserRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER'
}

export interface Participant {
  id: string;
  name: string;
  email: string;
}

export interface Task {
  id: string;
  title: string;
  assignee: string;
  status: 'pending' | 'completed';
}

export interface MindMapData {
  name: string;
  children?: MindMapData[];
}

export interface AccessLogEntry {
  timestamp: number;
  viewerRole: UserRole;
}

export interface Meeting {
  id: string;
  title: string;
  agenda: string;
  date: string;
  time: string;
  participants: Participant[];
  audioBase64?: string;
  transcript: string;
  summary: string;
  strategyShifts: string[];
  tasks: Task[];
  mindMap: MindMapData | null;
  status: 'draft' | 'published';
  createdAt: number;
  accessLogs: AccessLogEntry[];
  conclusion?: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
