import { IssueFSM, IssueData, IssueState } from '../../src/state-machine/IssueFSM';

describe('IssueFSM', () => {
  let testIssue: IssueData;

  beforeEach(() => {
    testIssue = {
      id: 'test-123',
      title: 'Test Issue',
      body: 'Test description',
      state: 'new' as IssueState,
      labels: []
    };
  });

  describe('initialization', () => {
    it('should transition from new to pending', async () => {
      const fsm = new IssueFSM(testIssue);
      await fsm.initialize();
      
      const issue = fsm.getIssue();
      expect(issue.state).toBe('pending');
    });

    it('should emit state-changed event', async () => {
      const fsm = new IssueFSM(testIssue);
      const stateChangedSpy = jest.fn();
      fsm.on('state-changed', stateChangedSpy);
      
      await fsm.initialize();
      
      expect(stateChangedSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'new',
          to: 'pending'
        })
      );
    });

    it('should emit ready-for-processing event', async () => {
      const fsm = new IssueFSM(testIssue);
      const readySpy = jest.fn();
      fsm.on('ready-for-processing', readySpy);
      
      await fsm.initialize();
      
      expect(readySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          state: 'pending'
        })
      );
    });
  });

  describe('priority assignment', () => {
    it('should assign critical priority for critical keywords', async () => {
      const issue = {
        ...testIssue,
        title: 'Critical production bug'
      };
      const fsm = new IssueFSM(issue);
      await fsm.initialize();
      
      expect(fsm.getIssue().priority).toBe('critical');
    });

    it('should assign high priority for high keywords', async () => {
      const issue = {
        ...testIssue,
        title: 'Important blocker issue'
      };
      const fsm = new IssueFSM(issue);
      await fsm.initialize();
      
      expect(fsm.getIssue().priority).toBe('high');
    });

    it('should assign low priority for low keywords', async () => {
      const issue = {
        ...testIssue,
        title: 'Minor documentation update'
      };
      const fsm = new IssueFSM(issue);
      await fsm.initialize();
      
      expect(fsm.getIssue().priority).toBe('low');
    });

    it('should default to medium priority', async () => {
      const fsm = new IssueFSM(testIssue);
      await fsm.initialize();
      
      expect(fsm.getIssue().priority).toBe('medium');
    });
  });

  describe('label assignment', () => {
    it('should add priority label', async () => {
      const fsm = new IssueFSM(testIssue);
      await fsm.initialize();
      
      const labels = fsm.getIssue().labels;
      expect(labels).toContain('priority:medium');
    });

    it('should add bug label for bug-related issues', async () => {
      const issue = {
        ...testIssue,
        title: 'Fix bug in state machine'
      };
      const fsm = new IssueFSM(issue);
      await fsm.initialize();
      
      const labels = fsm.getIssue().labels;
      expect(labels).toContain('bug');
    });

    it('should add enhancement label for feature requests', async () => {
      const issue = {
        ...testIssue,
        title: 'Add new feature to pipeline'
      };
      const fsm = new IssueFSM(issue);
      await fsm.initialize();
      
      const labels = fsm.getIssue().labels;
      expect(labels).toContain('enhancement');
    });

    it('should add state label', async () => {
      const fsm = new IssueFSM(testIssue);
      await fsm.initialize();
      
      const labels = fsm.getIssue().labels;
      expect(labels).toContain('state:pending');
    });

    it('should not duplicate labels', async () => {
      const issue = {
        ...testIssue,
        labels: ['bug']
      };
      const fsm = new IssueFSM(issue);
      await fsm.initialize();
      
      const labels = fsm.getIssue().labels;
      const bugCount = labels.filter(l => l === 'bug').length;
      expect(bugCount).toBe(1);
    });
  });

  describe('state transitions', () => {
    it('should allow valid transitions', async () => {
      const fsm = new IssueFSM(testIssue);
      await fsm.initialize();
      
      await fsm.transition('in_progress');
      expect(fsm.getIssue().state).toBe('in_progress');
    });

    it('should reject invalid transitions', async () => {
      const fsm = new IssueFSM(testIssue);
      await fsm.initialize();
      
      await expect(fsm.transition('done')).rejects.toThrow('Invalid transition');
    });

    it('should track transition history', async () => {
      const fsm = new IssueFSM(testIssue);
      await fsm.initialize();
      await fsm.transition('in_progress');
      
      const history = fsm.getHistory();
      expect(history).toHaveLength(2); // pending + in_progress
      expect(history[1].to).toBe('in_progress');
    });

    it('should check if transition is valid', async () => {
      const fsm = new IssueFSM(testIssue);
      await fsm.initialize();
      
      expect(fsm.canTransitionTo('in_progress')).toBe(true);
      expect(fsm.canTransitionTo('done')).toBe(false);
    });
  });
});
