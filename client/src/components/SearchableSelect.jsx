import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

const SearchableSelect = ({
    options = [],
    value,
    onChange,
    placeholder = "Pilih opsi...",
    disabled = false,
    className = ""
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);
    const inputRef = useRef(null);

    // Initial check for selected value
    const selectedOption = options.find(o => o.id == value);
    const isOther = value === 'other';

    // Update internal search term when value changes externally
    useEffect(() => {
        if (selectedOption) {
            setSearchTerm(selectedOption.name);
        } else if (isOther) {
            setSearchTerm('+ Lainnya (Input Manual)');
        } else if (!value) {
            setSearchTerm('');
        }
    }, [value, selectedOption, isOther]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                // Reset search term to selected value on blur if no selection made
                if (selectedOption) {
                    setSearchTerm(selectedOption.name);
                } else if (isOther) {
                    setSearchTerm('+ Lainnya (Input Manual)');
                } else {
                    setSearchTerm('');
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [selectedOption, isOther]);

    const filteredOptions = options.filter(option => {
        // If the search term is exactly the same as the selected option's name,
        // it likely means the user just opened the dropdown and hasn't started typing yet.
        // In this case, we show all options.
        if (isOpen && selectedOption && searchTerm === selectedOption.name) return true;

        return option.name.toLowerCase().includes(searchTerm.toLowerCase());
    });

    const handleSelect = (option) => {
        onChange(option.id);
        setIsOpen(false);
        setSearchTerm(option.name);
    };

    const handleSelectOther = () => {
        onChange('other');
        setIsOpen(false);
        setSearchTerm('+ Lainnya (Input Manual)');
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            <div
                className={`flex items-center justify-between w-full border rounded-lg px-4 py-2.5 bg-white transition-all cursor-pointer ${disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 border-slate-300'
                    }`}
                onClick={() => {
                    if (!disabled) {
                        setIsOpen(true);
                        setTimeout(() => inputRef.current?.focus(), 0);
                        // Optional: Clear search term on open to allow fresh search? 
                        // Let's keep name to show what's selected, but select it all so typing replaces it
                        setTimeout(() => inputRef.current?.select(), 0);
                    }
                }}
            >
                <input
                    ref={inputRef}
                    type="text"
                    className={`w-full bg-transparent outline-none cursor-pointer ${disabled ? 'cursor-not-allowed' : ''}`}
                    placeholder={placeholder}
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        if (!isOpen) setIsOpen(true);
                    }}
                    disabled={disabled}
                    readOnly={!isOpen} // Only editable when open
                />
                <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-1">
                        {filteredOptions.length === 0 && (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                                Tidak ada data yang cocok.
                            </div>
                        )}

                        {filteredOptions.map((option) => (
                            <div
                                key={option.id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(option);
                                }}
                                className={`px-4 py-2 text-sm rounded-md cursor-pointer flex items-center justify-between group transition-colors ${value == option.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700 hover:bg-slate-50'
                                    }`}
                            >
                                <span>{option.name}</span>
                                {value == option.id && <Check size={14} />}
                            </div>
                        ))}

                        {/* Always show 'Other' option at the bottom */}
                        <div className="border-t border-slate-100 my-1"></div>
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                handleSelectOther();
                            }}
                            className={`px-4 py-2 text-sm rounded-md cursor-pointer flex items-center justify-between font-bold text-blue-600 hover:bg-blue-50 transition-colors ${value === 'other' ? 'bg-blue-50' : ''
                                }`}
                        >
                            <span>+ Lainnya (Input Manual)</span>
                            {value === 'other' && <Check size={14} />}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
