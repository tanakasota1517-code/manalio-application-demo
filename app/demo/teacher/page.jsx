import { AppExperience } from "../../app-experience";

export const metadata = {
  title: "教員画面デモ | Manalio",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DemoTeacherPage() {
  return (
    <>
      <div className="public-demo-route-note">
        このデモは架空の実習場面で試せます。実名・実習先名は入れないでください。教員画面の流れを確認できます。外部AI APIや学校データ保存は使いません。
      </div>
      <AppExperience publicDemoRole="teacher" publicDemoReturnHref="/demo" />
    </>
  );
}
