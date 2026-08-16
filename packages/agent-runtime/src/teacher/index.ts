/**
 * Agent-Steering Teacher — FID-2026-0813-011 master.
 *
 * Public surface for the headless teacher: the sandbox backend and the
 * exercise engine. The CLI `/learn` overlay consumes only these exports plus
 * the shared `common/teacher` contracts; it has no grader or sandbox authority.
 */
export * from './sandbox'
export * from './exercise'
export * from './corpus'
export * from './grading'
export * from './progression'
export { applyMutation, selectMutation } from './mutation'
