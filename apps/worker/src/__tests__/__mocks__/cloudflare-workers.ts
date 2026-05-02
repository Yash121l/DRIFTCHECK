export class WorkflowEntrypoint<_Env = unknown, _Params = unknown> {
  env!: _Env;
  ctx!: ExecutionContext;
}
