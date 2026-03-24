/**
 * Searchable select component with autocomplete functionality.
 *
 * Displays a text input that filters options as you type,
 * showing results in a dropdown list below.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';


export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  maxDescriptionWords?: number;
  allowCustom?: boolean;  // Allow entering values not in the list
  specialOptions?: SelectOption[];  // Options shown at top (e.g., "* All")
  focusColor?: string;
}


/**
 * Truncate text to a maximum number of words.
 */
function _truncateWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '...';
}


const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Search...',
  disabled = false,
  isLoading = false,
  maxDescriptionWords = 8,
  allowCustom = false,
  specialOptions = [],
  focusColor,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find the selected option to display its label
  const selectedOption = [...specialOptions, ...options].find((o) => o.value === value);

  // Filter options based on search query
  const filteredOptions = options.filter((option) => {
    const query = searchQuery.toLowerCase();
    return (
      option.label.toLowerCase().includes(query) ||
      option.value.toLowerCase().includes(query) ||
      (option.description?.toLowerCase().includes(query) ?? false)
    );
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    onChange('');
    setSearchQuery('');
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!isOpen) setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    } else if (e.key === 'Enter' && allowCustom && searchQuery.trim()) {
      handleSelect(searchQuery.trim());
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Input field */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={isOpen ? searchQuery : (selectedOption?.label || value || '')}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-9 pr-8 py-1.5 text-sm ${focusColor || 'focus:ring-ring'}`}
        />
        {value && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={handleClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-card border border-border
                        rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
          ) : (
            <>
              {/* Special options (e.g., "* All servers") */}
              {specialOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-accent
                             ${value === option.value ? 'bg-primary/10' : ''}`}
                >
                  <span className="font-medium text-primary">{option.label}</span>
                  {option.description && (
                    <span className="ml-2 text-muted-foreground text-xs">{option.description}</span>
                  )}
                </button>
              ))}

              {specialOptions.length > 0 && filteredOptions.length > 0 && (
                <div className="border-t border-border" />
              )}

              {/* Filtered options */}
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {searchQuery ? 'No matches found' : 'No options available'}
                </div>
              ) : (
                filteredOptions.slice(0, 50).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={`w-full text-left px-3 py-2 hover:bg-accent
                               ${value === option.value ? 'bg-primary/10' : ''}`}
                  >
                    <div className="text-sm text-foreground truncate">
                      {option.label}
                    </div>
                    {option.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {_truncateWords(option.description, maxDescriptionWords)}
                      </div>
                    )}
                  </button>
                ))
              )}

              {filteredOptions.length > 50 && (
                <div className="px-3 py-2 text-xs text-muted-foreground text-center border-t border-border">
                  Showing first 50 results. Type to filter.
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};


export default SearchableSelect;
