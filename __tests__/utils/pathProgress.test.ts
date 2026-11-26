import { followUpToGroupSave } from '../../utils/pathProgress';

describe('followUpToGroupSave', () => {
  it('leaves the screen alone when the group accepted the save', () => {
    expect(followUpToGroupSave({ status: 'saved', angNumber: 12, verseId: 120 })).toEqual({
      action: 'keep',
    });
  });

  it('adopts the server position when the group was already past this line', () => {
    expect(followUpToGroupSave({ status: 'behind', angNumber: 14, verseId: 141 })).toEqual({
      action: 'adopt',
      angNumber: 14,
      verseId: 141,
    });
  });

  it('puts the screen back when the save was refused', () => {
    // The screen moved its own highlight before asking. A refused save is rolled
    // back in the store, so anything left on screen is a line nobody else has.
    expect(followUpToGroupSave({ status: 'failed' })).toEqual({ action: 'revert' });
  });

  it('puts the screen back when the save never reached the server', () => {
    // The client does not throw on a dropped connection, so this is what offline looks like.
    expect(followUpToGroupSave({ status: 'offline' })).toEqual({ action: 'revert' });
  });
});
