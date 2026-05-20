import hashlib
import secrets
import sys
import os
import pandas as pd
import logging
from werkzeug.utils import secure_filename

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import Config
from database.models import get_db_session, User, MaterialUpload

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class UserManager:
    def __init__(self):
        pass
    
    def _hash_password(self, password, salt=None):
        if salt is None:
            salt = secrets.token_hex(16)
        password_hash = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return f"{salt}:{password_hash.hex()}"
    
    def _verify_password(self, password, stored_hash):
        try:
            salt, _ = stored_hash.split(':')
            computed_hash = self._hash_password(password, salt)
            return computed_hash == stored_hash
        except Exception as e:
            logger.error(f"密码验证失败: {e}")
            return False
    
    def create_user(self, username, email, password):
        session = get_db_session()
        try:
            existing_user = session.query(User).filter(
                (User.username == username) | (User.email == email)
            ).first()
            
            if existing_user:
                return None, "用户名或邮箱已存在"
            
            password_hash = self._hash_password(password)
            user = User(
                username=username,
                email=email,
                password_hash=password_hash
            )
            session.add(user)
            session.commit()
            logger.info(f"用户创建成功: {username}")
            return user.id, "用户创建成功"
        except Exception as e:
            session.rollback()
            logger.error(f"创建用户失败: {e}")
            raise e
        finally:
            session.close()
    
    def authenticate_user(self, username, password):
        session = get_db_session()
        try:
            user = session.query(User).filter(User.username == username).first()
            if not user:
                return None, "用户不存在"
            
            if self._verify_password(password, user.password_hash):
                return user.id, "登录成功"
            else:
                return None, "密码错误"
        finally:
            session.close()
    
    def get_user_info(self, user_id):
        session = get_db_session()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            if user:
                return {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'created_at': user.created_at
                }
            return None
        finally:
            session.close()
    
    def change_password(self, user_id, old_password, new_password):
        session = get_db_session()
        try:
            user = session.query(User).filter(User.id == user_id).first()
            if not user:
                return False, "用户不存在"
            
            if not self._verify_password(old_password, user.password_hash):
                return False, "原密码错误"
            
            user.password_hash = self._hash_password(new_password)
            session.commit()
            return True, "密码修改成功"
        except Exception as e:
            session.rollback()
            logger.error(f"密码修改失败: {e}")
            raise e
        finally:
            session.close()

class DataNormalizer:
    COLUMN_MAPPING = {
        'material_type': ['材质类型', '材料类型', '皮料类型', '材质', '类型', '皮类',
                          'material_type', 'materialType', 'Material_Type'],
        'source': ['来源', '产地', '来源地', '出处', 'source', 'Source', 'origin'],
        'thickness': ['厚度', '厚度(mm)', '厚度_mm', 'thickness', 'Thickness', '厚度mm'],
        'tensile_strength': ['抗张强度', '抗拉强度', '强度', '拉伸强度',
                              'tensile_strength', 'TensileStrength', 'strength'],
        'water_content': ['含水量', '含水率', '水分含量', '水分率',
                           'water_content', 'WaterContent', 'moisture'],
        'collagen_ratio': ['胶原蛋白比例', '胶原含量', '胶原蛋白含量',
                            'collagen_ratio', 'CollagenRatio', 'collagen'],
        'age_years': ['年龄', '年限', '年份', '使用年限', '保存年限',
                       'age_years', 'AgeYears', 'age'],
        'storage_condition': ['保存条件', '存储条件', '保存环境', '储存条件',
                               'storage_condition', 'StorageCondition', 'storage'],
        'collection_date': ['采集日期', '检测日期', '日期', '检测时间', '采集时间',
                             'collection_date', 'CollectionDate', 'date'],
        'pigment_name': ['颜料名称', '颜料', '颜色名称', '色料',
                          'pigment_name', 'PigmentName', 'pigment'],
        'chemical_composition': ['化学成分', '成分', '化学组成',
                                   'chemical_composition', 'ChemicalComposition'],
        'color_l': ['L*', 'L值', '亮度', '明度', 'color_l', 'ColorL', 'L'],
        'color_a': ['a*', 'a值', '红绿色度', 'color_a', 'ColorA', 'a'],
        'color_b': ['b*', 'b值', '黄蓝色度', 'color_b', 'ColorB', 'b'],
        'fade_rate': ['褪色率', '褪色速率', '褪色程度',
                       'fade_rate', 'FadeRate', 'fade'],
        'light_exposure_hours': ['光照小时数', '曝光时间', '光照时间',
                                  'light_exposure_hours', 'ExposureHours', 'hours']
    }
    
    @classmethod
    def normalize_columns(cls, df):
        mapping_dict = {}
        for standard_col, variants in cls.COLUMN_MAPPING.items():
            for variant in variants:
                for col in df.columns:
                    if str(col).strip().lower() == variant.lower():
                        mapping_dict[col] = standard_col
                        break
                    elif variant.lower() in str(col).strip().lower():
                        if col not in mapping_dict:
                            mapping_dict[col] = standard_col
        
        df = df.rename(columns=mapping_dict)
        logger.info(f"列名标准化完成，映射了 {len(mapping_dict)} 列")
        return df
    
    @staticmethod
    def normalize_numeric_columns(df, numeric_columns=None):
        if numeric_columns is None:
            numeric_columns = ['thickness', 'tensile_strength', 'water_content',
                              'collagen_ratio', 'age_years', 'color_l', 'color_a',
                              'color_b', 'fade_rate', 'light_exposure_hours']
        
        for col in numeric_columns:
            if col in df.columns:
                try:
                    df[col] = pd.to_numeric(df[col].astype(str).str.replace(',', '.'), errors='coerce')
                except Exception as e:
                    logger.warning(f"列 {col} 数值转换失败: {e}")
        
        return df
    
    @staticmethod
    def normalize_date_columns(df, date_columns=None):
        if date_columns is None:
            date_columns = ['collection_date']
        
        for col in date_columns:
            if col in df.columns:
                try:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
                except Exception as e:
                    logger.warning(f"列 {col} 日期转换失败: {e}")
        
        return df
    
    @staticmethod
    def remove_duplicates(df, subset=None):
        original_count = len(df)
        df = df.drop_duplicates(subset=subset, keep='first').reset_index(drop=True)
        removed_count = original_count - len(df)
        if removed_count > 0:
            logger.info(f"移除了 {removed_count} 条重复数据")
        return df
    
    @staticmethod
    def handle_missing_values(df, strategy='smart'):
        for col in df.columns:
            if df[col].isna().sum() > 0:
                if strategy == 'smart':
                    if pd.api.types.is_numeric_dtype(df[col]):
                        df[col] = df[col].fillna(df[col].median())
                    elif pd.api.types.is_datetime64_dtype(df[col]):
                        df[col] = df[col].fillna(df[col].mode().iloc[0] if not df[col].mode().empty else pd.NaT)
                    else:
                        df[col] = df[col].fillna('未知')
                elif strategy == 'drop':
                    df = df.dropna(subset=[col])
        
        return df
    
    @classmethod
    def normalize_data(cls, df):
        logger.info(f"开始数据标准化，原始数据: {len(df)}行 x {len(df.columns)}列")
        
        df = cls.normalize_columns(df)
        df = cls.normalize_numeric_columns(df)
        df = cls.normalize_date_columns(df)
        df = cls.remove_duplicates(df)
        df = cls.handle_missing_values(df)
        
        if 'material_type' in df.columns:
            df['material_type'] = df['material_type'].astype(str).str.strip()
        
        logger.info(f"数据标准化完成: {len(df)}行 x {len(df.columns)}列")
        return df

class FileUploadManager:
    SUPPORTED_FORMATS = {
        '.csv': 'CSV文件',
        '.xlsx': 'Excel文件',
        '.xls': 'Excel旧版文件',
        '.json': 'JSON文件',
        '.txt': '文本文件(制表符分隔)',
        '.tsv': 'TSV文件'
    }
    
    def __init__(self):
        self.upload_folder = Config.UPLOAD_FOLDER
        os.makedirs(self.upload_folder, exist_ok=True)
        self.normalizer = DataNormalizer()
    
    def _detect_encoding(self, filepath):
        encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'gb18030', 'latin1']
        for encoding in encodings:
            try:
                with open(filepath, 'r', encoding=encoding) as f:
                    f.read(10000)
                return encoding
            except UnicodeDecodeError:
                continue
        return 'utf-8'
    
    def _read_file_with_fallback(self, filepath, ext):
        if ext == '.csv' or ext == '.txt' or ext == '.tsv':
            sep = '\t' if ext in ['.txt', '.tsv'] else ','
            encoding = self._detect_encoding(filepath)
            
            encodings_to_try = [encoding, 'utf-8', 'utf-8-sig', 'gbk', 'gb18030']
            separators_to_try = [sep, ',', ';', '\t', '|']
            
            for enc in encodings_to_try:
                for sep in separators_to_try:
                    try:
                        df = pd.read_csv(filepath, sep=sep, encoding=enc, low_memory=False)
                        if len(df.columns) > 1:
                            logger.info(f"成功读取CSV文件: 编码={enc}, 分隔符={repr(sep)}")
                            return df
                    except Exception:
                        continue
            
            raise ValueError(f"无法解析CSV文件，尝试了多种编码和分隔符")
        
        elif ext in ['.xlsx', '.xls']:
            engines = ['openpyxl', 'xlrd', 'odf']
            for engine in engines:
                try:
                    df = pd.read_excel(filepath, engine=engine)
                    logger.info(f"成功读取Excel文件: engine={engine}")
                    return df
                except Exception as e:
                    logger.debug(f"Excel读取失败 (engine={engine}): {e}")
                    continue
            raise ValueError("无法解析Excel文件，请检查文件格式")
        
        elif ext == '.json':
            encodings_to_try = ['utf-8', 'utf-8-sig', 'gbk']
            for enc in encodings_to_try:
                try:
                    df = pd.read_json(filepath, encoding=enc)
                    logger.info(f"成功读取JSON文件: 编码={enc}")
                    return df
                except Exception as e:
                    logger.debug(f"JSON读取失败 (encoding={enc}): {e}")
                    continue
            raise ValueError("无法解析JSON文件，请检查文件格式")
        
        else:
            raise ValueError(f"不支持的文件格式: {ext}")
    
    def save_uploaded_file(self, file, user_id=None, auto_analyze=True):
        filename = secure_filename(file.filename)
        ext = os.path.splitext(filename)[1].lower()
        
        if ext not in self.SUPPORTED_FORMATS:
            supported = ', '.join(self.SUPPORTED_FORMATS.keys())
            raise ValueError(f"不支持的文件格式 '{ext}'。支持的格式: {supported}")
        
        timestamp = secrets.token_hex(8)
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(self.upload_folder, unique_filename)
        
        file.save(file_path)
        logger.info(f"文件已保存: {file_path}")
        
        upload_id = None
        if user_id:
            session = get_db_session()
            try:
                upload = MaterialUpload(
                    user_id=user_id,
                    filename=unique_filename,
                    status='pending'
                )
                session.add(upload)
                session.commit()
                upload_id = upload.id
            except Exception as e:
                session.rollback()
                logger.error(f"保存上传记录失败: {e}")
            finally:
                session.close()
        
        if auto_analyze:
            try:
                df = self._read_file_with_fallback(file_path, ext)
                df = self.normalizer.normalize_data(df)
                
                if user_id and upload_id:
                    self.update_upload_status(upload_id, 'processed')
                
                return upload_id, file_path, df
            except Exception as e:
                logger.error(f"文件处理失败: {e}")
                if user_id and upload_id:
                    self.update_upload_status(upload_id, 'error')
                raise
        
        return upload_id, file_path, None
    
    def process_local_file(self, filepath, auto_normalize=True):
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"文件不存在: {filepath}")
        
        ext = os.path.splitext(filepath)[1].lower()
        if ext not in self.SUPPORTED_FORMATS:
            supported = ', '.join(self.SUPPORTED_FORMATS.keys())
            raise ValueError(f"不支持的文件格式 '{ext}'。支持的格式: {supported}")
        
        df = self._read_file_with_fallback(filepath, ext)
        
        if auto_normalize:
            df = self.normalizer.normalize_data(df)
        
        return df
    
    def get_user_uploads(self, user_id):
        session = get_db_session()
        try:
            uploads = session.query(MaterialUpload).filter_by(user_id=user_id).all()
            return [
                {
                    'id': u.id,
                    'filename': u.filename,
                    'upload_date': u.upload_date,
                    'status': u.status,
                    'file_path': os.path.join(self.upload_folder, u.filename),
                    'original_filename': '_'.join(u.filename.split('_')[1:])
                }
                for u in uploads
            ]
        finally:
            session.close()
    
    def update_upload_status(self, upload_id, status):
        session = get_db_session()
        try:
            upload = session.query(MaterialUpload).filter_by(id=upload_id).first()
            if upload:
                upload.status = status
                session.commit()
                return True
            return False
        except Exception as e:
            session.rollback()
            logger.error(f"更新上传状态失败: {e}")
            return False
        finally:
            session.close()
    
    def delete_upload(self, upload_id):
        session = get_db_session()
        try:
            upload = session.query(MaterialUpload).filter_by(id=upload_id).first()
            if upload:
                file_path = os.path.join(self.upload_folder, upload.filename)
                if os.path.exists(file_path):
                    os.remove(file_path)
                
                session.delete(upload)
                session.commit()
                return True
            return False
        except Exception as e:
            session.rollback()
            logger.error(f"删除上传失败: {e}")
            return False
        finally:
            session.close()
