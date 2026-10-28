import { PASSWORD_POLICY_RULES } from "../../../auth/web/src";

/** Compact list of the fixed password rules under create / reset fields. */
export function PasswordPolicyHint({ className = "" }: { className?: string }) {
  return (
    <div className={`text-[12px] text-fg-muted ${className}`.trim()}>
      <p className="font-medium text-fg">Password must:</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {PASSWORD_POLICY_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </div>
  );
}
