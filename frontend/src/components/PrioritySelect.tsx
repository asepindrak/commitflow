import type { Task } from "../types";
import { makeSelectStyles, makeSelectTheme } from "../utils/selectStyles";
import Select from 'react-select';

export function PrioritySelect({
    value,
    onChange,
    dark,
}: {
    value?: Task['priority'];
    onChange: (v?: Task['priority']) => void;
    dark: boolean;
}) {
    const styles = makeSelectStyles(dark);
    const theme = makeSelectTheme(dark);

    const priorityOptions = [
        { value: 'low' as Task['priority'], label: 'Low', color: 'emerald' },
        { value: 'medium' as Task['priority'], label: 'Medium', color: 'amber' },
        { value: 'urgent' as Task['priority'], label: 'Urgent', color: 'red' },
    ];

    const formatOptionLabel = (opt: any) => (
        <div className="flex items-center gap-2 text-sm leading-none">
            <span
                className={`inline-block rounded-full`}
                style={{
                    width: 10,
                    height: 10,
                    backgroundColor:
                        opt.color === 'red'
                            ? '#ef4444'
                            : opt.color === 'amber'
                                ? '#f59e0b'
                                : '#10b981',
                }}
            />
            <span>{opt.label}</span>
        </div>
    );

    const SingleValue = (props: any) => {
        const opt = props.data;
        const color =
            opt.color === 'red'
                ? 'text-red-600'
                : opt.color === 'amber'
                    ? 'text-amber-600'
                    : 'text-emerald-600';
        return (
            <div className={`flex items-center gap-2 text-sm leading-none ${color}`}>
                <span
                    className="inline-block rounded-full"
                    style={{
                        width: 10,
                        height: 10,
                        backgroundColor:
                            opt.color === 'red'
                                ? '#ef4444'
                                : opt.color === 'amber'
                                    ? '#f59e0b'
                                    : '#10b981',
                    }}
                />
                {opt.label}
            </div>
        );
    };

    return (
        <Select
            options={priorityOptions}
            value={value ? priorityOptions.find((o) => o.value === value) : null}
            onChange={(opt: any) => onChange(opt ? opt.value : undefined)}
            styles={{
                ...styles,
                control: (provided: any, state: any) => ({
                    ...provided,
                    minHeight: 38,
                    height: 38,
                    borderRadius: 8,
                    paddingLeft: 4,
                    paddingRight: 4,
                    backgroundColor: 'transparent',
                    boxShadow: state.isFocused ? '0 0 0 1px #0ea5e9' : 'none',
                    borderColor: state.isFocused ? '#0ea5e9' : provided.borderColor,
                }),
                valueContainer: (provided: any) => ({
                    ...provided,
                    padding: '0 6px',
                    height: 38,
                    display: 'flex',
                    alignItems: 'center',
                }),
                singleValue: (provided: any) => ({
                    ...provided,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    lineHeight: 1,
                    margin: 0,
                    padding: 0,
                }),
                input: (provided: any) => ({
                    ...provided,
                    margin: 0,
                    padding: 0,
                }),
                indicatorsContainer: (provided: any) => ({
                    ...provided,
                    height: 38,
                }),
            }}
            theme={theme}
            formatOptionLabel={formatOptionLabel}
            components={{ SingleValue }}
            classNamePrefix="cf-select"
        />
    );
}
