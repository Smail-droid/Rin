import * as Switch from "@radix-ui/react-switch";
import { type ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import { Button } from "../components/button";
import { useConfirm } from "../components/dialog";
import { ImageUploadInput } from "../components/image-upload-input";
import { ImageWithFallback } from "../components/image-with-fallback";
import {
  SettingsCard,
  SettingsCardBody,
  SettingsCardHeader,
  SettingsCardRow,
  SettingsSectionTitle,
} from "@rin/ui";

export function ItemTitle({ title }: { title: string }) {
  return <SettingsSectionTitle title={title} />;
}

export function ItemSwitch({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="w-full">
      <SettingsCard>
        <SettingsCardRow
          header={<SettingsCardHeader title={title} description={description} />}
          action={
            <Switch.Root className="SwitchRoot" checked={checked} onCheckedChange={onChange}>
              <Switch.Thumb className="SwitchThumb" />
            </Switch.Root>
          }
        />
      </SettingsCard>
    </div>
  );
}

export function ItemInput({
  title,
  configKeyTitle,
  description,
  value,
  placeholder,
  onChange,
}: {
  title: string;
  description: string;
  configKeyTitle: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      <SettingsCard>
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => {
            setIsOpen((current) => {
              return !current;
            });
          }}
        >
          <SettingsCardRow
            header={<SettingsCardHeader title={title} description={description} />}
            action={
              <div className="flex items-center gap-3">
                <span className="max-w-56 truncate text-sm text-neutral-500 dark:text-neutral-400">
                  {value || placeholder || configKeyTitle}
                </span>
                <i
                  className={`ri-arrow-down-s-line text-lg text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </div>
            }
          />
        </button>
        {isOpen ? (
          <SettingsCardBody>
            <textarea
              placeholder={placeholder || configKeyTitle}
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
              }}
              className="min-h-36 w-full rounded-xl border border-black/10 bg-w px-4 py-3 text-sm t-primary outline-none transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500 dark:focus:border-white/20"
            />
          </SettingsCardBody>
        ) : null}
      </SettingsCard>
    </div>
  );
}

export function ItemEmojiInput({
  title,
  description,
  configKeyTitle,
  value,
  placeholder,
  presetEmojis,
  onChange,
}: {
  title: string;
  description: string;
  configKeyTitle: string;
  value: string;
  placeholder?: string;
  presetEmojis: string[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      <SettingsCard>
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => setIsOpen((c) => !c)}
        >
          <SettingsCardRow
            header={<SettingsCardHeader title={title} description={description} />}
            action={
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-100 text-lg shadow-2xs dark:bg-white/10">
                  {value || placeholder || "🐾"}
                </span>
                <i
                  className={`ri-arrow-down-s-line text-lg text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </div>
            }
          />
        </button>
        {isOpen ? (
          <SettingsCardBody>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                placeholder={placeholder || configKeyTitle}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full rounded-xl border border-black/10 bg-w px-4 py-2.5 text-base font-bold t-primary outline-none transition-colors focus:border-theme focus:ring-2 focus:ring-theme/20 dark:border-white/10"
              />
              <div>
                <p className="text-xs text-neutral-400 mb-1.5">点击下方专属适配符号快速填入：</p>
                <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                  {presetEmojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onChange(emoji)}
                      className={`h-8 w-8 rounded-lg flex items-center justify-center text-base hover:scale-125 transition-transform hover:bg-white dark:hover:bg-neutral-800 shadow-2xs ${
                        value === emoji ? "bg-theme/15 ring-1 ring-theme scale-110" : ""
                      }`}
                      title={`填入 ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SettingsCardBody>
        ) : null}
      </SettingsCard>
    </div>
  );
}

export function ItemButton({
  title,
  description,
  buttonTitle,
  onConfirm,
  alertTitle,
  alertDescription,
}: {
  title: string;
  description: string;
  buttonTitle: string;
  onConfirm: () => Promise<void>;
  alertTitle: string;
  alertDescription: string;
}) {
  const { showConfirm, ConfirmUI } = useConfirm();

  return (
    <div className="w-full">
      <SettingsCard>
        <SettingsCardRow
          header={<SettingsCardHeader title={title} description={description} />}
          action={
            <Button
              title={buttonTitle}
              onClick={() => {
                showConfirm(alertTitle, alertDescription, onConfirm);
              }}
            />
          }
        />
      </SettingsCard>
      <ConfirmUI />
    </div>
  );
}

export function ItemWithUpload({
  title,
  description,
  accept,
  onFileChange,
}: {
  title: string;
  description: string;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  accept: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useTranslation();

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    try {
      await onFileChange(event);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <SettingsCard>
        <SettingsCardRow
          header={<SettingsCardHeader title={title} description={description} />}
          action={
            <>
              {loading && <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" />}
              <input ref={inputRef} type="file" className="hidden" accept={accept} onChange={handleFileChange} />
              <Button
                onClick={() => {
                  inputRef.current?.click();
                }}
                title={t("upload.title")}
              />
            </>
          }
        />
      </SettingsCard>
    </div>
  );
}

export function ItemImageInput({
  title,
  description,
  configKeyTitle,
  value,
  placeholder,
  onChange,
  onError,
  shape = "rounded",
}: {
  title: string;
  description: string;
  configKeyTitle: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onError?: (message: string) => void;
  shape?: "rounded" | "circle";
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      <SettingsCard>
        <button
          type="button"
          className="block w-full text-left"
          onClick={() => {
            setIsOpen((current) => !current);
          }}
        >
          <SettingsCardRow
            header={<SettingsCardHeader title={title} description={description} />}
            action={
              <div className="flex items-center gap-3">
                {value ? (
                  <ImageWithFallback
                    src={value}
                    alt={configKeyTitle}
                    className={`h-10 w-10 ${shape === "circle" ? "rounded-full" : "rounded-2xl"}`}
                  />
                ) : null}
                <span className="max-w-56 truncate text-sm text-neutral-500 dark:text-neutral-400">
                  {value || placeholder || configKeyTitle}
                </span>
                <i
                  className={`ri-arrow-down-s-line text-lg text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </div>
            }
          />
        </button>
        {isOpen ? (
          <SettingsCardBody>
            <ImageUploadInput
              value={value}
              onChange={onChange}
              onError={onError}
              placeholder={placeholder || configKeyTitle}
              shape={shape}
            />
          </SettingsCardBody>
        ) : null}
      </SettingsCard>
    </div>
  );
}
