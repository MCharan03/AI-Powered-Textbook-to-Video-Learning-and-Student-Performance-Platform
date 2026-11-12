import React from 'react';
import { Check, Circle } from 'lucide-react';

interface WorkflowStepperProps {
  steps: string[];
  currentStep: number; // 0-based index of the active/next step
  compact?: boolean;
}

/**
 * Horizontal workflow indicator used to show where a textbook /
 * content item currently sits in the pipeline:
 * Upload → Extract → Review → Plans → Scripts → Videos → Publish.
 */
export const WorkflowStepper: React.FC<WorkflowStepperProps> = ({ steps, currentStep, compact = false }) => (
  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: compact ? '4px' : '6px' }}>
    {steps.map((step, idx) => {
      const done = idx < currentStep;
      const active = idx === currentStep;
      const color = done ? 'var(--admin-success)' : active ? 'var(--admin-primary)' : 'var(--admin-text-secondary)';
      return (
        <React.Fragment key={step}>
          {idx > 0 && (
            <div
              style={{
                width: compact ? '10px' : '18px',
                height: '1px',
                backgroundColor: done ? 'var(--admin-success)' : 'var(--admin-border)',
                flexShrink: 0,
              }}
            />
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: compact ? '2px 6px' : '3px 10px',
              borderRadius: '999px',
              backgroundColor: active ? 'var(--admin-primary-soft)' : 'transparent',
              border: active ? '1px solid var(--admin-primary)' : '1px solid transparent',
            }}
          >
            <span
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color,
                flexShrink: 0,
              }}
            >
              {done ? <Check size={11} strokeWidth={3} /> : <Circle size={7} fill={active ? color : 'var(--admin-border)'} />}
            </span>
            {!compact && (
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: active ? 600 : 500,
                  color: done || active ? color : 'var(--admin-text-secondary)',
                  whiteSpace: 'nowrap',
                }}
              >
                {step}
              </span>
            )}
          </div>
        </React.Fragment>
      );
    })}
  </div>
);
