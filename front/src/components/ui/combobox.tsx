import * as React from "react"
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import Select from "react-select"

import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: number
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: number | null
  onChange: (value: number | null) => void
  id?: string
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
}

/** Filtro "contém", sem acento-sensibilidade básica, sobre o rótulo. */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/**
 * Select com busca (estilo select2), construído sobre o Base UI Combobox.
 *
 * Trabalha com `value` numérico (id) e `onChange(id)`, mas internamente usa
 * objetos `{ value, label }` para exibir e filtrar pelo rótulo. Funciona bem
 * dentro de diálogos (o Base UI coordena os popups aninhados).
 */
export function Combobox({
  options,
  value,
  onChange,
  id,
  placeholder = "Selecione…",
  emptyText = "Nenhum resultado encontrado.",
  disabled,
  className,
  "aria-invalid": ariaInvalid,
}: ComboboxProps) {
  const selected = React.useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  )

  return (
    <ComboboxPrimitive.Root
      items={options}
      value={selected}
      disabled={disabled}
      onValueChange={(item: ComboboxOption | null) => onChange(item ? item.value : null)}
      itemToStringLabel={(item: ComboboxOption | null) => item?.label ?? ""}
      isItemEqualToValue={(a: ComboboxOption | null, b: ComboboxOption | null) =>
        a?.value === b?.value
      }
      filter={(item: ComboboxOption, query: string) =>
        normalizar(item.label).includes(normalizar(query))
      }
    >
      <div className="relative">
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={ariaInvalid}
          className={cn(
            "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 pr-8 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm",
            className
          )}
        />
        <ComboboxPrimitive.Trigger
          disabled={disabled}
          className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center text-muted-foreground disabled:opacity-50"
          aria-label="Abrir lista"
        >
          <ChevronsUpDownIcon className="size-4" />
        </ComboboxPrimitive.Trigger>
      </div>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner sideOffset={4} className="z-50 outline-none">
          <ComboboxPrimitive.Popup
            className={cn(
              "max-h-[min(var(--available-height),18rem)] w-[var(--anchor-width)] overflow-y-auto overflow-x-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none",
              "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
            )}
          >
            <ComboboxPrimitive.Empty className="px-2 py-3 text-center text-sm text-muted-foreground">
              {emptyText}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(item: ComboboxOption) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
                    "data-highlighted:bg-muted data-selected:font-medium"
                  )}
                >
                  <ComboboxPrimitive.ItemIndicator className="flex w-4 shrink-0 items-center justify-center">
                    <CheckIcon className="size-4" />
                  </ComboboxPrimitive.ItemIndicator>
                  <span className="truncate">{item.label}</span>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  )
}

interface ComboboxMultiProps {
  options: ComboboxOption[]
  value: number[]
  onChange: (values: number[]) => void
  id?: string
  placeholder?: string
  emptyText?: string
  disabled?: boolean
  "aria-invalid"?: boolean
}

/**
 * Select **múltiplo** com busca e chips (estilo select2), sobre o `react-select`.
 *
 * Trabalha com `value` como lista de ids numéricos; internamente usa objetos
 * `{ value, label }`. O `react-select` está em modo `unstyled`, tematizado via
 * `classNames` com os tokens do design (Tailwind). Usa `menuPosition="fixed"`
 * (sem portal) para não ser cortado por contêineres com `overflow` e, ao mesmo
 * tempo, permanecer dentro do DOM de diálogos/sheets (evitando fechá-los ao
 * clicar numa opção).
 */
export function ComboboxMulti({
  options,
  value,
  onChange,
  id,
  placeholder = "Selecione…",
  emptyText = "Nenhum resultado encontrado.",
  disabled,
  "aria-invalid": ariaInvalid,
}: ComboboxMultiProps) {
  // Preserva a ordem de seleção e reutiliza as referências de `options`.
  const porId = React.useMemo(() => new Map(options.map((o) => [o.value, o])), [options])
  const selected = React.useMemo(
    () => value.map((v) => porId.get(v)).filter((o): o is ComboboxOption => Boolean(o)),
    [value, porId]
  )

  return (
    <Select<ComboboxOption, true>
      inputId={id}
      isMulti
      unstyled
      isDisabled={disabled}
      options={options}
      value={selected}
      onChange={(items) => onChange(items.map((i) => i.value))}
      placeholder={placeholder}
      noOptionsMessage={() => emptyText}
      closeMenuOnSelect={false}
      menuPosition="fixed"
      menuPlacement="auto"
      filterOption={(option, input) => normalizar(option.label).includes(normalizar(input))}
      classNames={{
        control: (state) =>
          cn(
            "flex min-h-8 w-full items-center rounded-lg border bg-transparent px-1.5 py-0.5 text-sm transition-colors",
            state.isFocused ? "border-ring ring-3 ring-ring/50" : "border-input",
            ariaInvalid && "border-destructive ring-destructive/20",
            state.isDisabled && "cursor-not-allowed opacity-50"
          ),
        valueContainer: () => "flex flex-wrap items-center gap-1 py-0.5",
        placeholder: () => "px-1 text-muted-foreground",
        input: () => "text-sm text-foreground",
        multiValue: () =>
          "inline-flex items-center gap-1 rounded-md border border-border bg-muted py-0.5 pl-2 pr-0.5 text-xs",
        multiValueLabel: () => "truncate text-foreground",
        multiValueRemove: () =>
          "flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground cursor-pointer",
        indicatorsContainer: () => "flex items-center gap-0.5 pl-1",
        indicatorSeparator: () => "hidden",
        dropdownIndicator: () => "p-1 text-muted-foreground",
        clearIndicator: () => "p-1 text-muted-foreground hover:text-foreground cursor-pointer",
        menu: () =>
          "z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-lg",
        menuList: () => "max-h-60 overflow-y-auto p-1",
        option: (state) =>
          cn(
            "cursor-pointer rounded-sm px-2 py-1.5 text-sm",
            state.isFocused && "bg-muted",
            state.isSelected && "font-medium"
          ),
        noOptionsMessage: () => "px-2 py-3 text-center text-sm text-muted-foreground",
      }}
      styles={{ menuPortal: (base) => ({ ...base, zIndex: 60 }) }}
    />
  )
}
