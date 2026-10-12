import assert from "node:assert/strict";
const [base, mode] = process.argv.slice(2);
const url = new URL(base);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !['writable', 'read-only'].includes(mode)) throw new Error('Synthetic write tests require an explicit localhost URL and writable|read-only mode.');
const request = (path, body, cookie) => fetch(new URL(path, base), { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const home = await request('/');
assert.equal(home.status, 200); assert.match(await home.text(), /FOIA Idea Board/);
assert.equal((await request('/test-missing-route')).status, 404);
const list = await request('/api/ideas'); assert.equal(list.status, 200); assert.match(list.headers.get('cache-control') ?? '', /no-store/);
assert.ok(Array.isArray((await list.json()).ideas));
const missing = '99999999-9999-4999-8999-999999999999';
if (mode === 'read-only') {
  for (const path of ['/api/ideas', `/api/ideas/${missing}/comments`, '/api/votes']) {
    const response = await request(path, {}); assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), '60'); assert.equal(response.headers.get('set-cookie'), null);
    assert.match((await response.json()).error, /temporarily paused/);
  }
  assert.match(await (await request('/')).text(), /Posting and voting are temporarily paused/);
} else {
  assert.equal((await request('/api/ideas', { title: 'no', description: 'short' })).status, 400);
  assert.equal((await request('/api/ideas/not-uuid/comments')).status, 400);
  assert.equal((await request(`/api/ideas/${missing}/comments`)).status, 404);
  assert.equal((await request('/api/votes', { targetType: 'idea', targetId: missing })).status, 404);
  const response = await request('/api/ideas', { title: 'Synthetic migration test', description: 'This is local test data only.' }); assert.equal(response.status, 201);
  const { idea } = await response.json();
  const commentResponse = await request(`/api/ideas/${idea.id}/comments`, { body: 'Synthetic local comment' }); assert.equal(commentResponse.status, 201);
  const { comment } = await commentResponse.json();
  const vote = await request('/api/votes', { targetType: 'idea', targetId: idea.id }); assert.equal(vote.status, 201);
  const setCookie = vote.headers.get('set-cookie'); assert.ok(setCookie); assert.match(setCookie, /HttpOnly/i); assert.match(setCookie, /SameSite=Lax/i); assert.match(setCookie, /Max-Age=604800/i); assert.match(setCookie, /Path=\//i); assert.doesNotMatch(setCookie, /Domain=/i);
  if (process.env.EXPECT_SECURE_COOKIE === 'true') assert.match(setCookie, /; Secure/i);
  const cookie = setCookie.split(';')[0];
  const duplicate = await request('/api/votes', { targetType: 'idea', targetId: idea.id }, cookie); assert.equal(duplicate.status, 200); assert.deepEqual(await duplicate.json(), { status: 'already_voted', votes: 1 }); assert.equal(duplicate.headers.get('set-cookie'), null);
  const concurrent = await Promise.all(Array.from({length: 12}, () => request('/api/votes', {targetType: 'comment', targetId: comment.id}, 'foia_voter=legacy-opaque-browser-key')));
  assert.equal(concurrent.filter((r) => r.status === 201).length, 1); assert.equal(concurrent.filter((r) => r.status === 200).length, 11);
  const final = await (await request(`/api/ideas/${idea.id}/comments`)).json(); assert.equal(final.comments[0].votes, 1);
  const finalIdeas = await (await request('/api/ideas')).json(); assert.equal(finalIdeas.ideas.find((row) => row.id === idea.id).commentCount, 1);
}
console.log(`PASS ${mode}: HTTP routes, real 404, uncached reads${mode === 'writable' ? ', create/comment/vote, cookie continuity and concurrent deduplication' : ', all write endpoints frozen and visible notice'}`);
