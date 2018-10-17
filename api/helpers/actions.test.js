const actions   = require('./actions');

test('Testing publish.', () => {
    var o = {};
    o.tags = [['sysadmin']];

    expect(actions.isPublished(o)).toEqual(undefined);

    o.tags = [['sysadmin'], ['public']];
    expect(actions.isPublished(o)).toEqual(['public']);
});

