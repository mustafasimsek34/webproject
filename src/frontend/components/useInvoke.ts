import { useCallback, useState } from 'react';
import { invoke } from '@forge/bridge';
import { Result } from '../../shared/types';

export function useInvoke<T, P>(resolver: string) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>();
	const [code, setCode] = useState<string>();
	const [data, setData] = useState<T>();
	const run = useCallback(async (payload: P) => {
		setLoading(true);
		setError(undefined);
		setCode(undefined);
		try {
			const result = (await invoke(resolver, payload as never)) as Result<T>;
			if (!result.ok) {
				setError(result.message);
				setCode(result.code);
				return result;
			}
			setData(result.data);
			return result;
		} catch (caught) {
			const message = caught instanceof Error ? caught.message : 'Request failed';
			setError(message);
			setCode('NETWORK');
			return { ok: false as const, code: 'NETWORK', message };
		} finally {
			setLoading(false);
		}
	}, [resolver]);
	return { run, loading, error, code, data };
}
