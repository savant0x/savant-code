import { afterEach, describe, expect, test } from 'bun:test'

import { useChatStore } from '../chat-store'

import type { TeacherSessionState } from '../../teacher/runtime'

function teacherState(): TeacherSessionState {
  return {
    challenge: null,
    phase: 'ready',
    completionState: null,
    events: [],
    steering: '',
    attemptId: null,
    receipt: null,
    persisted: false,
    competencyState: null,
  }
}

afterEach(() => {
  useChatStore.getState().clearTeacher()
})

describe('chat store teacher slice (FID-2026-0813-022)', () => {
  test('setTeacherState replaces the slice and clearTeacher empties it', () => {
    const state = teacherState()
    useChatStore.getState().setTeacherState(state)
    expect(useChatStore.getState().teacherState).toEqual(state)
    useChatStore.getState().clearTeacher()
    expect(useChatStore.getState().teacherState).toBeNull()
  })

  test('reset clears the teacher slice', () => {
    useChatStore.getState().setTeacherState(teacherState())
    expect(useChatStore.getState().teacherState).not.toBeNull()
    useChatStore.getState().reset()
    expect(useChatStore.getState().teacherState).toBeNull()
  })
})
