const auth   = require('./auth');
var mongoose  = require('mongoose');

test('Testing issue token.', () => {
    expect.any(auth.issueToken("","",""));
});

test('Testing hashPassword.', () => {
    var user = {
        password: 'testpasswd'
    };
    var userWithPassword = auth.setPassword(user);
    var crypto = require('crypto');
    var hashedPasswd = crypto.pbkdf2Sync('testpasswd', new Buffer(userWithPassword.salt, 'base64'), 10000, 64, 'sha1').toString('base64');
    expect(userWithPassword.password).toEqual(hashedPasswd);
});