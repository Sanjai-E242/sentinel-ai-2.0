export class ScopeAuthorizationService {
  /**
   * Determines if the requested scope is authorized given the agent's granted scopes.
   * Supports exact matching and standard wildcard matching (e.g. 'project.*' or '*').
   */
  public isAuthorized(agentScopes: string[], requestedScope: string): boolean {
    if (!Array.isArray(agentScopes) || !requestedScope || typeof requestedScope !== 'string') {
      return false;
    }

    const target = requestedScope.trim().toLowerCase();

    for (const scope of agentScopes) {
      if (!scope || typeof scope !== 'string') continue;
      const granted = scope.trim().toLowerCase();

      // Universal wildcard
      if (granted === '*') {
        return true;
      }

      // Exact match
      if (granted === target) {
        return true;
      }

      // Prefix wildcard match (e.g., 'project.*' matching 'project.read')
      if (granted.endsWith('.*')) {
        const prefix = granted.slice(0, -2);
        if (target === prefix || target.startsWith(`${prefix}.`)) {
          return true;
        }
      }
    }

    return false;
  }
}

export const scopeAuthorizationService = new ScopeAuthorizationService();
