import { useEffect, useState } from 'react';
import type { AIConnectionResult, AIProviderId, SecretKey, SecretStatus } from '@shared/types';
import { DEFAULT_MODELS, PROVIDER_BLURBS, PROVIDER_LABELS, requiresApiKey } from '@shared/ai/provider';
import { useApp } from '../state/store';
import { updateSettings } from '../state/actions';
import { Icon } from './Icons';

const PROVIDERS: AIProviderId[] = ['ollama', 'openai-compatible', 'openai', 'anthropic'];

const SECRET_SLOT: Record<AIProviderId, SecretKey | null> = {
  ollama: null,
  openai: 'openai',
  anthropic: 'anthropic',
  'openai-compatible': 'custom',
};

interface TextFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  hint?: string;
  onCommit: (value: string) => void;
}

/** Text input that commits on blur or Enter to avoid a write per keystroke. */
function TextField({ label, value, placeholder, hint, onCommit }: TextFieldProps) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft !== value) onCommit(draft.trim());
  };
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        type="text"
        value={draft}
        placeholder={placeholder}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          }
        }}
      />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/**
 * Backend chooser shared by the setup wizard and the settings panel.
 * API keys are written straight to the OS-encrypted secret store.
 */
export function AIProviderFields() {
  const settings = useApp((state) => state.settings);
  const [secrets, setSecrets] = useState<SecretStatus | null>(null);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyBusy, setKeyBusy] = useState(false);
  const [testResult, setTestResult] = useState<AIConnectionResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);

  const provider = settings.ai.provider;
  const slot = SECRET_SLOT[provider];

  useEffect(() => {
    void window.carbon.secrets.status().then(setSecrets);
  }, []);

  const patchAI = (patch: Partial<typeof settings.ai>) => {
    void updateSettings({ ai: { ...settings.ai, ...patch } });
    setTestResult(null);
  };

  const chooseProvider = (id: AIProviderId) => {
    patchAI({ provider: id, model: DEFAULT_MODELS[id] });
    setModelOptions([]);
    setKeyDraft('');
  };

  const saveKey = async () => {
    if (!slot || !keyDraft.trim()) return;
    setKeyBusy(true);
    try {
      const status = await window.carbon.secrets.set(slot, keyDraft.trim());
      setSecrets(status);
      setKeyDraft('');
      setTestResult({ ok: true, models: [], message: 'API key saved with Windows secure storage.' });
    } catch (error) {
      setTestResult({ ok: false, models: [], message: (error as Error).message });
    } finally {
      setKeyBusy(false);
    }
  };

  const clearKey = async () => {
    if (!slot) return;
    const status = await window.carbon.secrets.clear(slot);
    setSecrets(status);
    setTestResult(null);
  };

  const test = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await window.carbon.ai.test();
      setTestResult(result);
      if (result.models.length > 0) setModelOptions(result.models);
    } catch (error) {
      setTestResult({ ok: false, models: [], message: (error as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const fetchModels = async () => {
    const result = await window.carbon.ai.models();
    if (result.error) setTestResult({ ok: false, models: [], message: result.error });
    else setModelOptions(result.models);
  };

  const keySaved = slot ? Boolean(secrets?.[slot]) : false;

  return (
    <div className="provider-fields">
      <div className="provider-grid" role="radiogroup" aria-label="AI backend">
        {PROVIDERS.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={provider === id}
            className={`provider-card${provider === id ? ' is-selected' : ''}`}
            onClick={() => chooseProvider(id)}
          >
            <div className="provider-card-head">
              <span className="provider-name">{PROVIDER_LABELS[id]}</span>
              {provider === id ? <Icon name="check" size={14} /> : null}
            </div>
            <p>{PROVIDER_BLURBS[id]}</p>
          </button>
        ))}
      </div>

      <div className="provider-config">
        {provider === 'ollama' ? (
          <>
            <TextField
              label="Ollama server"
              value={settings.ai.ollama.baseUrl}
              placeholder="http://127.0.0.1:11434"
              hint="The default port for a local Ollama install."
              onCommit={(value) => patchAI({ ollama: { ...settings.ai.ollama, baseUrl: value } })}
            />
            <TextField
              label="Model"
              value={settings.ai.ollama.model}
              placeholder="llama3.2"
              hint="Run `ollama pull <model>` first. Examples: llama3.2, qwen2.5, mistral."
              onCommit={(value) => patchAI({ ollama: { ...settings.ai.ollama, model: value } })}
            />
          </>
        ) : null}

        {provider === 'openai-compatible' ? (
          <>
            <TextField
              label="Base URL"
              value={settings.ai.custom.baseUrl}
              placeholder="http://127.0.0.1:1234/v1"
              hint="Include the API prefix, usually /v1. Works with LM Studio, vLLM, OpenRouter and gateways."
              onCommit={(value) => patchAI({ custom: { ...settings.ai.custom, baseUrl: value } })}
            />
            <TextField
              label="Model"
              value={settings.ai.custom.model}
              placeholder="gpt-4o-mini"
              onCommit={(value) => patchAI({ custom: { ...settings.ai.custom, model: value } })}
            />
          </>
        ) : null}

        {provider === 'openai' ? (
          <TextField
            label="Model"
            value={settings.ai.openai.model}
            placeholder="gpt-4o-mini"
            onCommit={(value) => patchAI({ openai: { ...settings.ai.openai, model: value } })}
          />
        ) : null}

        {provider === 'anthropic' ? (
          <TextField
            label="Model"
            value={settings.ai.anthropic.model}
            placeholder="claude-3-5-sonnet-latest"
            onCommit={(value) => patchAI({ anthropic: { ...settings.ai.anthropic, model: value } })}
          />
        ) : null}

        {slot ? (
          <div className="field">
            <span className="field-label">
              API key {keySaved ? <span className="pill pill-success">Saved</span> : null}
            </span>
            <div className="key-row">
              <input
                type="password"
                value={keyDraft}
                autoComplete="off"
                spellCheck={false}
                placeholder={keySaved ? '•••••••••••• (stored securely)' : 'Paste your API key'}
                aria-label="API key"
                onChange={(event) => setKeyDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void saveKey();
                }}
              />
              <button
                type="button"
                className="button button-secondary button-small"
                onClick={() => void saveKey()}
                disabled={!keyDraft.trim() || keyBusy}
              >
                Save key
              </button>
              {keySaved ? (
                <button type="button" className="button button-ghost button-small" onClick={() => void clearKey()}>
                  Remove
                </button>
              ) : null}
            </div>
            <span className="field-hint">
              Encrypted with Windows secure storage (DPAPI). Keys never touch the settings file or the note editor.
            </span>
          </div>
        ) : null}

        {requiresApiKey(provider) && !keySaved ? (
          <p className="callout callout-warning">
            <Icon name="warning" size={14} /> This provider needs an API key before Carbon can send a request.
          </p>
        ) : null}

        <div className="provider-actions">
          <button type="button" className="button button-secondary button-small" onClick={() => void test()} disabled={testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
          <button type="button" className="button button-ghost button-small" onClick={() => void fetchModels()}>
            Fetch models
          </button>
        </div>

        {testResult ? (
          <div className={`callout ${testResult.ok ? 'callout-success' : 'callout-error'}`} role="status">
            <Icon name={testResult.ok ? 'check' : 'warning'} size={14} />
            <span>{testResult.message}</span>
          </div>
        ) : null}

        {modelOptions.length > 0 ? (
          <label className="field">
            <span className="field-label">Available models</span>
            <select
              value=""
              onChange={(event) => {
                const value = event.target.value;
                if (!value) return;
                if (provider === 'ollama') patchAI({ ollama: { ...settings.ai.ollama, model: value } });
                else if (provider === 'openai') patchAI({ openai: { model: value } });
                else if (provider === 'anthropic') patchAI({ anthropic: { model: value } });
                else patchAI({ custom: { ...settings.ai.custom, model: value } });
              }}
            >
              <option value="">Choose a model…</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    </div>
  );
}
