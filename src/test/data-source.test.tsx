import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { useDataSource, useExams, useExamMutations, useGenerateDataset } from "@/lib/data-source";
import { buildDemoDataset } from "@/lib/demo";
import { DEFAULT_DATASET_PARAMS } from "@/lib/dataset-validation";

afterEach(() => vi.restoreAllMocks());
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <DataSourceProvider>{children}</DataSourceProvider>
    </QueryClientProvider>
  );
  return { client, wrapper };
}
describe("API/demo isolation", () => {
  it("loads live exams only after a successful health check and keeps them in api keys", async () => {
    vi.spyOn(api, "health").mockResolvedValue({ status: "ok" });
    const live = [buildDemoDataset().exams[0]];
    vi.spyOn(api, "exams").mockResolvedValue(live);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => ({ source: useDataSource(), exams: useExams() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.exams.data).toEqual(live));
    expect(result.current.source.mode).toBe("api");
    expect(client.getQueryData(["demo", "exams"])).toBeUndefined();
    client.clear();
  });
  it("does not switch to demo when an individual live endpoint fails", async () => {
    vi.spyOn(api, "health").mockResolvedValue({ status: "ok" });
    vi.spyOn(api, "exams").mockRejectedValue(new Error("backend failure"));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => ({ source: useDataSource(), exams: useExams() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.exams.error?.message).toBe("backend failure"), {
      timeout: 4000,
    });
    expect(result.current.source.mode).toBe("api");
    expect(result.current.exams.data).toBeUndefined();
    client.clear();
  });
  it("uses explicitly selected demo data after failed health and never writes to the API", async () => {
    vi.spyOn(api, "health").mockRejectedValue(new Error("unavailable"));
    const generate = vi.spyOn(api, "generateDataset");
    const { client, wrapper } = setup();
    const { result } = renderHook(
      () => ({ source: useDataSource(), generate: useGenerateDataset() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.source.mode).toBe("demo"));
    let response;
    await act(async () => {
      response = await result.current.generate.mutateAsync(DEFAULT_DATASET_PARAMS);
    });
    expect(response).toMatchObject({ demo: true, exams: 48 });
    expect(generate).not.toHaveBeenCalled();
    client.clear();
  });
  it("invalidates live exams after creating one so the next read returns the saved record", async () => {
    vi.spyOn(api, "health").mockResolvedValue({ status: "ok" });
    const exam = buildDemoDataset().exams[0];
    const read = vi.spyOn(api, "exams").mockResolvedValueOnce([]).mockResolvedValue([exam]);
    vi.spyOn(api, "createExam").mockResolvedValue(exam);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => ({ exams: useExams(), mutations: useExamMutations() }), {
      wrapper,
    });
    await waitFor(() => expect(result.current.exams.data).toEqual([]));
    const { id, ...input } = exam;
    await act(async () => {
      await result.current.mutations.save.mutateAsync({ input });
    });
    await waitFor(() => expect(result.current.exams.data).toEqual([exam]));
    expect(read).toHaveBeenCalledTimes(2);
    client.clear();
  });
});
import { DataSourceProvider } from "@/lib/data-source-provider";
