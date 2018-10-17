const utils   = require('./utils');
var mongoose  = require('mongoose');

test('Testing buildQuery.', () => {
  expect(utils.buildQuery("_id", "5ab5639291b5ea001975f3e1", {})).toEqual({ _id: { '$in': [ mongoose.Types.ObjectId('5ab5639291b5ea001975f3e1') ] } });
});

