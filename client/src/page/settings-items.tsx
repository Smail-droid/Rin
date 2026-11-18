import { type ChangeEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import {
  SettingsCard,
  SettingsCardBody,
  SettingsCardHeader,
  SettingsCardRow,
} from "@rin/ui";
import { Button } from "../components/button";
import { ImageUploadInput } from "../components/image-upload-input";
import { ImageWithFallback } from "../components/image-with-fallback";

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
              {loading ? <ReactLoading width="1em" height="1em" type="spin" color="#FC466B" /> : null}
              <input ref={inputRef} type="file" className="hidden" accept={accept} onChange={handleFileChange} />
              <Button onClick={() => inputRef.current?.click()} title={t("upload.title")} />
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
          onClick={() => setIsOpen((current) => !current)}
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
