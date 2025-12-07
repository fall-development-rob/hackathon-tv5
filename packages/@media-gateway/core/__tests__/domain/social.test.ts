/**
 * Social Domain Layer Tests
 *
 * Tests for Friend, GroupEntity, GroupSessionEntity, RecommendationEntity, and GroupCompatibility
 */

import { describe, it, expect } from 'vitest';
import {
  Friend,
  GroupEntity,
  GroupSessionEntity,
  RecommendationEntity,
  GroupCompatibility,
  type RecommendationContext,
  type GroupCandidate,
  type MediaContent,
} from '../../src/domain/social/index.js';

describe('Friend Entity', () => {
  const createFriend = () => new Friend(
    'user-1',
    'user-2',
    'John Doe',
    'https://avatar.com/john.jpg',
    new Date('2024-01-01'),
    new Date('2024-12-06')
  );

  it('should check if recently active', () => {
    const recentFriend = new Friend(
      'u1', 'u2', 'Recent', undefined,
      new Date(),
      new Date()
    );
    expect(recentFriend.isRecentlyActive()).toBe(true);

    const inactiveFriend = new Friend(
      'u1', 'u2', 'Inactive', undefined,
      new Date(),
      new Date('2024-01-01')
    );
    expect(inactiveFriend.isRecentlyActive()).toBe(false);
  });

  it('should calculate friendship duration', () => {
    const friend = createFriend();
    const duration = friend.getFriendshipDuration();
    expect(duration).toBeGreaterThan(300); // More than 300 days
  });

  it('should detect new friendships', () => {
    const newFriend = new Friend(
      'u1', 'u2', 'New', undefined,
      new Date(),
      new Date()
    );
    expect(newFriend.isNewFriendship()).toBe(true);

    const oldFriend = createFriend();
    expect(oldFriend.isNewFriendship()).toBe(false);
  });
});

describe('GroupEntity', () => {
  const createGroup = () => new GroupEntity(
    'group-1',
    'Movie Night',
    'creator-id',
    ['creator-id', 'member-1', 'member-2'],
    new Date('2024-01-01'),
    new Date('2024-12-01'),
    'Weekly movie watching group',
    'https://avatar.com/group.jpg'
  );

  describe('member management', () => {
    it('should get member IDs', () => {
      const group = createGroup();
      expect(group.getMemberIds()).toHaveLength(3);
      expect(group.getMemberCount()).toBe(3);
    });

    it('should check membership', () => {
      const group = createGroup();
      expect(group.hasMember('member-1')).toBe(true);
      expect(group.hasMember('non-member')).toBe(false);
    });

    it('should check if user is creator', () => {
      const group = createGroup();
      expect(group.isCreator('creator-id')).toBe(true);
      expect(group.isCreator('member-1')).toBe(false);
    });

    it('should add new member', () => {
      const group = createGroup();
      const updated = group.addMember('new-member');

      expect(updated.getMemberCount()).toBe(4);
      expect(updated.hasMember('new-member')).toBe(true);
      expect(group.getMemberCount()).toBe(3); // Original unchanged
    });

    it('should not duplicate members', () => {
      const group = createGroup();
      const updated = group.addMember('member-1'); // Already exists
      expect(updated.getMemberCount()).toBe(3);
    });

    it('should remove member', () => {
      const group = createGroup();
      const updated = group.removeMember('member-1');

      expect(updated.getMemberCount()).toBe(2);
      expect(updated.hasMember('member-1')).toBe(false);
    });

    it('should throw when removing creator', () => {
      const group = createGroup();
      expect(() => group.removeMember('creator-id')).toThrow('Cannot remove group creator');
    });
  });

  describe('group activity', () => {
    it('should detect active groups', () => {
      const activeGroup = new GroupEntity(
        'g1', 'Active', 'creator', ['creator'],
        new Date(),
        new Date()
      );
      expect(activeGroup.isActive()).toBe(true);
    });

    it('should detect inactive groups', () => {
      const inactiveDate = new Date();
      inactiveDate.setDate(inactiveDate.getDate() - 30);
      const group = new GroupEntity(
        'g1', 'Inactive', 'creator', ['creator'],
        new Date('2024-01-01'),
        inactiveDate
      );
      expect(group.isActive()).toBe(false);
    });
  });

  describe('group size classification', () => {
    it('should identify small groups (2-5 members)', () => {
      const small = new GroupEntity('g1', 'Small', 'c', ['c', 'm1', 'm2'], new Date(), new Date());
      expect(small.isSmallGroup()).toBe(true);
      expect(small.isLargeGroup()).toBe(false);
    });

    it('should identify large groups (>10 members)', () => {
      const members = Array.from({ length: 12 }, (_, i) => `member-${i}`);
      const large = new GroupEntity('g1', 'Large', 'c', members, new Date(), new Date());
      expect(large.isLargeGroup()).toBe(true);
      expect(large.isSmallGroup()).toBe(false);
    });
  });
});

describe('GroupSessionEntity', () => {
  const createContent = (): MediaContent => ({
    id: 1,
    title: 'Test Movie',
    overview: 'Description',
    mediaType: 'movie',
    genreIds: [28],
    voteAverage: 7.5,
    voteCount: 1000,
    releaseDate: '2023-01-01',
    posterPath: null,
    backdropPath: null,
    popularity: 50,
  });

  const createCandidate = (id: number): GroupCandidate => ({
    content: { ...createContent(), id },
    groupScore: 0.8,
    fairnessScore: 0.7,
    individualScores: { 'user-1': 0.9, 'user-2': 0.7 },
    votes: {},
  });

  const createSession = () => new GroupSessionEntity(
    'session-1',
    'group-1',
    'voting',
    'user-1',
    {} as RecommendationContext,
    [createCandidate(1), createCandidate(2), createCandidate(3)],
    undefined,
    new Date(),
    undefined
  );

  describe('candidate management', () => {
    it('should get all candidates', () => {
      const session = createSession();
      expect(session.getCandidates()).toHaveLength(3);
    });

    it('should get top candidate by group score', () => {
      const candidates = [
        { ...createCandidate(1), groupScore: 0.7 },
        { ...createCandidate(2), groupScore: 0.9 },
        { ...createCandidate(3), groupScore: 0.8 },
      ];
      const session = new GroupSessionEntity(
        'session-1', 'group-1', 'voting', 'user-1',
        {} as RecommendationContext, candidates,
        undefined, new Date(), undefined
      );

      const top = session.getTopCandidate();
      expect(top?.content.id).toBe(2);
    });

    it('should return null for empty candidates', () => {
      const session = new GroupSessionEntity(
        'session-1', 'group-1', 'voting', 'user-1',
        {} as RecommendationContext, [],
        undefined, new Date(), undefined
      );
      expect(session.getTopCandidate()).toBeNull();
    });
  });

  describe('voting', () => {
    it('should add vote for candidate', () => {
      const session = createSession();
      const updated = session.addVote(1, 'user-1', 8.5);

      const voteCount = updated.getVoteCount(1);
      expect(voteCount).toBe(1);
    });

    it('should count votes per candidate', () => {
      let session = createSession();
      session = session.addVote(1, 'user-1', 8);
      session = session.addVote(1, 'user-2', 7);
      session = session.addVote(2, 'user-1', 6);

      expect(session.getVoteCount(1)).toBe(2);
      expect(session.getVoteCount(2)).toBe(1);
    });

    it('should detect when all users voted', () => {
      let session = createSession();
      expect(session.hasAllVoted(2)).toBe(false);

      session = session.addVote(1, 'user-1', 8);
      session = session.addVote(1, 'user-2', 7);

      expect(session.hasAllVoted(2)).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('should transition from voting to decided', () => {
      const session = createSession();
      const decided = session.decide(1);

      expect(decided.status).toBe('decided');
      expect(decided.selectedContentId).toBe(1);
      expect(decided.decidedAt).toBeDefined();
    });

    it('should throw when deciding outside voting phase', () => {
      const session = new GroupSessionEntity(
        's1', 'g1', 'decided', 'u1',
        {} as RecommendationContext, [],
        1, new Date(), new Date()
      );
      expect(() => session.decide(1)).toThrow('Can only decide during voting phase');
    });

    it('should transition from decided to watching', () => {
      let session = createSession();
      session = session.decide(1);
      const watching = session.startWatching();

      expect(watching.status).toBe('watching');
    });

    it('should throw when starting watch without decision', () => {
      const session = createSession();
      expect(() => session.startWatching()).toThrow('Must decide on content before watching');
    });

    it('should transition from watching to completed', () => {
      let session = createSession();
      session = session.decide(1);
      session = session.startWatching();
      const completed = session.complete();

      expect(completed.status).toBe('completed');
    });

    it('should throw when completing outside watching phase', () => {
      const session = createSession();
      expect(() => session.complete()).toThrow('Can only complete while watching');
    });
  });

  describe('session metrics', () => {
    it('should calculate session duration', () => {
      const created = new Date('2024-12-07T10:00:00');
      const decided = new Date('2024-12-07T10:15:00');

      const session = new GroupSessionEntity(
        's1', 'g1', 'decided', 'u1',
        {} as RecommendationContext, [],
        1, created, decided
      );

      expect(session.getSessionDuration()).toBe(15);
    });

    it('should return null for duration when not decided', () => {
      const session = createSession();
      expect(session.getSessionDuration()).toBeNull();
    });

    it('should detect stale voting sessions', () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25);

      const session = new GroupSessionEntity(
        's1', 'g1', 'voting', 'u1',
        {} as RecommendationContext, [],
        undefined, oldDate, undefined
      );

      expect(session.isStale()).toBe(true);
    });

    it('should not flag non-voting sessions as stale', () => {
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 25);

      const session = new GroupSessionEntity(
        's1', 'g1', 'decided', 'u1',
        {} as RecommendationContext, [],
        1, oldDate, new Date()
      );

      expect(session.isStale()).toBe(false);
    });
  });
});

describe('RecommendationEntity', () => {
  const createRecommendation = () => new RecommendationEntity(
    123,
    0.85,
    'Matches your action preferences',
    ['preference-match', 'popular'],
    new Date()
  );

  it('should identify highly relevant recommendations', () => {
    const high = new RecommendationEntity(1, 0.9, 'reason', [], new Date());
    const low = new RecommendationEntity(2, 0.6, 'reason', [], new Date());

    expect(high.isHighlyRelevant()).toBe(true);
    expect(low.isHighlyRelevant()).toBe(false);
  });

  it('should check if recommendation is fresh', () => {
    const fresh = createRecommendation();
    expect(fresh.isFresh()).toBe(true);

    const old = new Date();
    old.setHours(old.getHours() - 2);
    const stale = new RecommendationEntity(1, 0.8, 'reason', [], old);
    expect(stale.isFresh()).toBe(false);
  });

  it('should normalize score to 0-100', () => {
    const rec = createRecommendation();
    expect(rec.getNormalizedScore()).toBe(85);
  });
});

describe('GroupCompatibility', () => {
  const createCompatibility = () => {
    const similarities = new Map([
      ['user-1', new Map([
        ['user-2', 0.8],
        ['user-3', 0.6],
      ])],
      ['user-2', new Map([
        ['user-1', 0.8],
        ['user-3', 0.9],
      ])],
      ['user-3', new Map([
        ['user-1', 0.6],
        ['user-2', 0.9],
      ])],
    ]);
    return new GroupCompatibility(similarities, 0.77);
  };

  it('should get compatibility between two members', () => {
    const compat = createCompatibility();
    expect(compat.getCompatibility('user-1', 'user-2')).toBe(0.8);
    expect(compat.getCompatibility('user-2', 'user-3')).toBe(0.9);
  });

  it('should identify high compatibility groups', () => {
    const high = new GroupCompatibility(new Map(), 0.75);
    const low = new GroupCompatibility(new Map(), 0.5);

    expect(high.hasHighCompatibility()).toBe(true);
    expect(low.hasHighCompatibility()).toBe(false);
  });

  it('should find most compatible pair', () => {
    const compat = createCompatibility();
    const pair = compat.getMostCompatiblePair();

    expect(pair).toBeDefined();
    expect(pair?.score).toBe(0.9);
    expect([pair?.user1, pair?.user2]).toContain('user-2');
    expect([pair?.user1, pair?.user2]).toContain('user-3');
  });

  it('should find least compatible pair', () => {
    const compat = createCompatibility();
    const pair = compat.getLeastCompatiblePair();

    expect(pair).toBeDefined();
    expect(pair?.score).toBe(0.6);
    expect([pair?.user1, pair?.user2]).toContain('user-1');
    expect([pair?.user1, pair?.user2]).toContain('user-3');
  });

  it('should handle empty compatibility map', () => {
    const empty = new GroupCompatibility(new Map(), 0);
    expect(empty.getMostCompatiblePair()).toBeNull();
    expect(empty.getLeastCompatiblePair()).toBeNull();
  });
});
