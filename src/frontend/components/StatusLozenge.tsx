import React from 'react';
import { Lozenge } from '@forge/react';
import { Status } from '../../shared/types';
import { t } from '../../shared/i18n';
const labels: Record<Status, keyof typeof import('../../shared/i18n/en').en> = { confirmed: 'confirmed', expired: 'expired', outstanding: 'requiredTitle', 'cannot-view': 'cannotView', 'page-deleted': 'pageDeleted' };
export function StatusLozenge({ status }: { status: Status }) { return <Lozenge appearance={status === 'confirmed' ? 'success' : status === 'expired' ? 'moved' : status === 'cannot-view' ? 'removed' : 'default'}>{t(labels[status])}</Lozenge>; }
