<?php
namespace Modules\integration;

class FieldMapping
{
    public static function getSkillMapping(): array
    {
        return [
            'local_to_remote' => [
                'skill_no' => 'heritage_id',
                'name' => 'heritage_name',
                'category' => 'category_code',
                'level' => 'heritage_level',
                'heritor_name' => 'inheritor_name',
                'heritor_id_card' => 'inheritor_idcard',
                'application_area' => 'apply_area',
                'materials' => 'raw_materials',
                'tools' => 'craft_tools',
                'tech_description' => 'tech_intro',
                'status' => 'data_status',
                'created_at' => 'create_time',
                'updated_at' => 'update_time',
            ],
            'remote_to_local' => [
                'heritage_id' => 'skill_no',
                'heritage_name' => 'name',
                'category_code' => 'category',
                'heritage_level' => 'level',
                'inheritor_name' => 'heritor_name',
                'inheritor_idcard' => 'heritor_id_card',
                'apply_area' => 'application_area',
                'raw_materials' => 'materials',
                'craft_tools' => 'tools',
                'tech_intro' => 'tech_description',
                'data_status' => 'status',
                'create_time' => 'created_at',
                'update_time' => 'updated_at',
            ]
        ];
    }

    public static function getHeritorMapping(): array
    {
        return [
            'local_to_remote' => [
                'heritor_no' => 'inheritor_id',
                'name' => 'inheritor_name',
                'gender' => 'gender_code',
                'birth_date' => 'birthday',
                'id_card' => 'idcard_no',
                'ethnicity' => 'nation',
                'education' => 'education_level',
                'profession' => 'career',
                'skill_name' => 'heritage_name',
                'qualification_level' => 'qual_level',
                'qualification_date' => 'qual_date',
                'qualification_org' => 'issue_org',
                'address' => 'residence',
                'phone' => 'contact_phone',
                'email' => 'contact_email',
                'status' => 'data_status',
                'created_at' => 'create_time',
                'updated_at' => 'update_time',
            ],
            'remote_to_local' => [
                'inheritor_id' => 'heritor_no',
                'inheritor_name' => 'name',
                'gender_code' => 'gender',
                'birthday' => 'birth_date',
                'idcard_no' => 'id_card',
                'nation' => 'ethnicity',
                'education_level' => 'education',
                'career' => 'profession',
                'heritage_name' => 'skill_name',
                'qual_level' => 'qualification_level',
                'qual_date' => 'qualification_date',
                'issue_org' => 'qualification_org',
                'residence' => 'address',
                'contact_phone' => 'phone',
                'contact_email' => 'email',
                'data_status' => 'status',
                'create_time' => 'created_at',
                'update_time' => 'updated_at',
            ]
        ];
    }

    public static function getArchiveMapping(): array
    {
        return [
            'local_to_remote' => [
                'archive_no' => 'archive_id',
                'skill_no' => 'heritage_id',
                'skill_name' => 'heritage_name',
                'heritor_name' => 'inheritor_name',
                'final_level' => 'result_level',
                'total_score' => 'score_value',
                'archive_hash' => 'verify_hash',
                'archive_status' => 'archive_status',
                'archiver_user_id' => 'operator_id',
                'archived_at' => 'archive_time',
                'created_at' => 'create_time',
                'updated_at' => 'update_time',
            ],
            'remote_to_local' => [
                'archive_id' => 'archive_no',
                'heritage_id' => 'skill_no',
                'heritage_name' => 'skill_name',
                'inheritor_name' => 'heritor_name',
                'result_level' => 'final_level',
                'score_value' => 'total_score',
                'verify_hash' => 'archive_hash',
                'archive_status' => 'archive_status',
                'operator_id' => 'archiver_user_id',
                'archive_time' => 'archived_at',
                'create_time' => 'created_at',
                'update_time' => 'updated_at',
            ]
        ];
    }

    public static function mapFields(array $data, string $type, string $direction): array
    {
        $mappingMethod = "get{$type}Mapping";
        if (!method_exists(self::class, $mappingMethod)) {
            return $data;
        }
        
        $mapping = self::$mappingMethod();
        $fieldMap = $mapping[$direction] ?? [];
        
        $result = [];
        foreach ($data as $key => $value) {
            if (isset($fieldMap[$key])) {
                $result[$fieldMap[$key]] = $value;
            } else {
                $result[$key] = $value;
            }
        }
        
        return $result;
    }

    public static function mapBatchFields(array $dataList, string $type, string $direction): array
    {
        $result = [];
        foreach ($dataList as $data) {
            $result[] = self::mapFields($data, $type, $direction);
        }
        return $result;
    }
}