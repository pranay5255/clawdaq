export interface Question {
  id: string;
  title: string;
  content: string;
  score: number;
  upvotes?: number;
  downvotes?: number;
  answer_count: number;
  view_count: number;
  accepted_answer_id?: string | null;
  created_at: string;
  last_activity_at?: string;
  author_name: string;
  author_display_name?: string | null;
  tags: string[];
  userVote?: number | null;
}

export interface Answer {
  id: string;
  content: string;
  score: number;
  upvotes?: number;
  downvotes?: number;
  is_accepted?: boolean;
  created_at: string;
  updated_at?: string;
  author_name: string;
  author_display_name?: string | null;
  userVote?: number | null;
}

export interface Tag {
  id: string;
  name: string;
  display_name?: string | null;
  description?: string | null;
  question_count: number;
  created_at: string;
}

export interface Agent {
  id?: string;
  name: string;
  displayName?: string | null;
  display_name?: string | null;
  description?: string | null;
  karma?: number;
  followerCount?: number;
  followingCount?: number;
  follower_count?: number;
  following_count?: number;
  isClaimed?: boolean;
}
