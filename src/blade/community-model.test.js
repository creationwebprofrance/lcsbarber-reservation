import { expect, test } from 'bun:test';
import { MEDIA_LIMITS, validateMedia, publicEligible, participantAllowed, bookingTarget } from './community-model';
test('only requested photo/video formats are accepted', () => {
  expect(validateMedia({type:'image/svg+xml',size:100})).toBe('format');
  expect(validateMedia({type:'image/webp',size:100})).toBeNull();
  expect(validateMedia({type:'video/webm',size:100},30)).toBeNull();
});
test('photos are capped at 10 MB', () => {
  expect(MEDIA_LIMITS.imageBytes).toBe(10485760);
  expect(validateMedia({type:'image/png',size:10485761})).toBe('size');
});
test('videos are capped at 50 MB and 60 seconds', () => {
  expect(validateMedia({type:'video/mp4',size:52428801},60)).toBe('size');
  expect(validateMedia({type:'video/mp4',size:52428800},61)).toBe('duration');
  expect(validateMedia({type:'video/mp4',size:52428800},60)).toBeNull();
});
test('only published ready content from active matching providers is public', () => {
  const p={status:'published',ready:true,active:true,serviceActive:true,serviceProvider:'a',provider:'a'};
  expect(publicEligible(p)).toBe(true);
  for(const values of [{status:'draft'},{ready:false},{active:false},{serviceActive:false},{serviceProvider:'b'}]) expect(publicEligible({...p,...values})).toBe(false);
});
test('a third provider cannot participate in private messages', () => {
  expect(participantAllowed('a',['a','b'])).toBe(true);
  expect(participantAllowed('c',['a','b'])).toBe(false);
  expect(participantAllowed(null,['a','b'])).toBe(false);
});
test('reservation carries the exact provider and service and rejects unsupported paths', () => {
  expect(bookingTarget('/reservation','provider-a','service-b')).toBe('/reservation?blade_provider=provider-a&blade_service=service-b');
  expect(bookingTarget(null,'a','b')).toBeNull();
  expect(bookingTarget('https://example.com','a','b')).toBeNull();
});